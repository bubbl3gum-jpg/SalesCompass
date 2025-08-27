import { parse as csvParse } from 'csv-parse';
import * as XLSX from 'xlsx';
import { transferImportStorage } from './objectStorage';
import { db } from './db';
import { toItemList } from '../shared/schema';
import crypto from 'crypto';

export interface ImportProgress {
  phase: 'parsing' | 'validating' | 'writing' | 'done' | 'failed';
  rowsTotal: number;
  rowsParsed: number;
  rowsValid: number;
  rowsWritten: number;
  rowsFailed: number;
  duplicatesSkipped: number;
  throughputRps: number;
  etaSeconds: number;
  startedAt: Date;
  updatedAt: Date;
  errorSummary?: string[];
}

export interface TransferImportJob {
  uploadId: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  fileSha256: string;
  toId: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: ImportProgress;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory job store (in production, use Redis)
const jobs = new Map<string, TransferImportJob>();
const progressUpdateCallbacks = new Map<string, (progress: ImportProgress) => void>();

export class TransferImportProcessor {
  
  // Create new import job
  createJob(params: {
    uploadId: string;
    fileKey: string;
    fileName: string;
    fileSize: number;
    fileSha256: string;
    toId: number;
    idempotencyKey: string;
  }): TransferImportJob {
    // Check idempotency
    const existingJob = Array.from(jobs.values()).find(
      job => job.idempotencyKey === params.idempotencyKey
    );
    if (existingJob) {
      return existingJob;
    }

    const job: TransferImportJob = {
      ...params,
      status: 'queued',
      progress: {
        phase: 'parsing',
        rowsTotal: 0,
        rowsParsed: 0,
        rowsValid: 0,
        rowsWritten: 0,
        rowsFailed: 0,
        duplicatesSkipped: 0,
        throughputRps: 0,
        etaSeconds: 0,
        startedAt: new Date(),
        updatedAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    jobs.set(params.uploadId, job);
    
    // Start processing asynchronously
    this.processJob(params.uploadId).catch(error => {
      console.error(`❌ Job ${params.uploadId} failed:`, error);
      this.updateJobStatus(params.uploadId, 'failed');
    });

    return job;
  }

  // Get job status
  getJob(uploadId: string): TransferImportJob | null {
    return jobs.get(uploadId) || null;
  }

  // Subscribe to progress updates
  subscribeToProgress(uploadId: string, callback: (progress: ImportProgress) => void): void {
    progressUpdateCallbacks.set(uploadId, callback);
  }

  // Unsubscribe from progress updates  
  unsubscribeFromProgress(uploadId: string): void {
    progressUpdateCallbacks.delete(uploadId);
  }

  // Process the import job
  private async processJob(uploadId: string): Promise<void> {
    const job = jobs.get(uploadId);
    if (!job) throw new Error(`Job ${uploadId} not found`);

    try {
      console.log(`📊 Starting transfer import job ${uploadId}`);
      job.status = 'processing';
      job.updatedAt = new Date();

      // Stream file from object storage
      const stream = await transferImportStorage.streamFileContent(job.fileKey);
      
      // Detect file type and parse
      const records = await this.parseFile(stream, job.fileName, uploadId);
      
      // Update progress
      job.progress.rowsTotal = records.length;
      job.progress.rowsParsed = records.length;
      job.progress.phase = 'validating';
      this.emitProgress(uploadId);

      // Validate and process records
      const validRecords = await this.validateRecords(records, uploadId);
      
      // Update progress
      job.progress.rowsValid = validRecords.length;
      job.progress.rowsFailed = records.length - validRecords.length;
      job.progress.phase = 'writing';
      this.emitProgress(uploadId);

      // Batch write to database
      await this.writeToDatabase(validRecords, job.toId, uploadId);
      
      // Complete
      job.status = 'completed';
      job.progress.phase = 'done';
      job.progress.rowsWritten = validRecords.length;
      job.updatedAt = new Date();
      this.emitProgress(uploadId);

      console.log(`✅ Transfer import job ${uploadId} completed: ${validRecords.length} records`);

    } catch (error) {
      console.error(`❌ Transfer import job ${uploadId} failed:`, error);
      job.status = 'failed';
      job.progress.phase = 'failed';
      job.updatedAt = new Date();
      this.emitProgress(uploadId);
    }
  }

  // Parse CSV or XLSX file
  private async parseFile(stream: NodeJS.ReadableStream, fileName: string, uploadId: string): Promise<any[]> {
    const isExcel = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls');
    
    if (isExcel) {
      return this.parseExcel(stream, uploadId);
    } else {
      return this.parseCSV(stream, uploadId);
    }
  }

  // Parse CSV file using streaming
  private async parseCSV(stream: NodeJS.ReadableStream, uploadId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const records: any[] = [];
      const parser = csvParse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
      });

      parser.on('data', (record) => {
        records.push(record);
        
        // Update progress every 1000 records
        if (records.length % 1000 === 0) {
          const job = jobs.get(uploadId);
          if (job) {
            job.progress.rowsParsed = records.length;
            this.calculateThroughput(job);
            this.emitProgress(uploadId);
          }
        }
      });

      parser.on('end', () => {
        console.log(`📊 CSV parsed: ${records.length} records`);
        resolve(records);
      });

      parser.on('error', (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      });

      stream.pipe(parser);
    });
  }

  // Parse Excel file
  private async parseExcel(stream: NodeJS.ReadableStream, uploadId: string): Promise<any[]> {
    // Read entire stream into buffer (for XLSX parsing)
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          
          // Use first worksheet
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const records = XLSX.utils.sheet_to_json(worksheet);
          
          console.log(`📊 Excel parsed: ${records.length} records`);
          resolve(records);
        } catch (error) {
          reject(new Error(`Excel parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
      stream.on('error', reject);
    });
  }

  // Validate records and map columns
  private async validateRecords(records: any[], uploadId: string): Promise<any[]> {
    const validRecords: any[] = [];
    const job = jobs.get(uploadId);
    if (!job) throw new Error(`Job ${uploadId} not found`);

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      // Map columns with aliases
      const mappedRecord = {
        sn: record.sn || record.serial_number || record['Serial Number'] || record['serial no'] || '',
        kodeItem: record.kode_item || record.item_code || record['Item Code'] || record.sku || record.itemcode || '',
        namaItem: record.nama_item || record.item_name || record['Item Name'] || record['product name'] || '',
        qty: parseInt(record.qty || record.quantity || record.jumlah || '1') || 1
      };

      // Validate required fields
      if (mappedRecord.sn || mappedRecord.kodeItem) {
        validRecords.push(mappedRecord);
      } else {
        job.progress.rowsFailed++;
      }

      // Update progress every 1000 records
      if (i % 1000 === 0 && i > 0) {
        job.progress.rowsParsed = i;
        this.calculateThroughput(job);
        this.emitProgress(uploadId);
      }
    }

    return validRecords;
  }

  // Write records to database in batches
  private async writeToDatabase(records: any[], toId: number, uploadId: string): Promise<void> {
    const job = jobs.get(uploadId);
    if (!job) throw new Error(`Job ${uploadId} not found`);

    const batchSize = 5000;
    let written = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const insertData = batch.map(record => ({
        toId,
        ...record
      }));

      try {
        await db.insert(toItemList).values(insertData);
        written += batch.length;
        
        // Update progress
        job.progress.rowsWritten = written;
        this.calculateThroughput(job);
        this.emitProgress(uploadId);
        
        console.log(`📝 Batch written: ${written}/${records.length} records`);
      } catch (error) {
        console.error('❌ Batch write error:', error);
        throw error;
      }
    }
  }

  // Calculate throughput and ETA
  private calculateThroughput(job: TransferImportJob): void {
    const now = new Date();
    const elapsed = (now.getTime() - job.progress.startedAt.getTime()) / 1000;
    
    if (elapsed > 0) {
      job.progress.throughputRps = Math.round(job.progress.rowsParsed / elapsed);
      
      const remaining = job.progress.rowsTotal - job.progress.rowsParsed;
      if (job.progress.throughputRps > 0) {
        job.progress.etaSeconds = Math.round(remaining / job.progress.throughputRps);
      }
    }
    
    job.progress.updatedAt = now;
  }

  // Emit progress update
  private emitProgress(uploadId: string): void {
    const job = jobs.get(uploadId);
    if (!job) return;
    
    const callback = progressUpdateCallbacks.get(uploadId);
    if (callback) {
      callback(job.progress);
    }
  }

  // Update job status
  private updateJobStatus(uploadId: string, status: TransferImportJob['status']): void {
    const job = jobs.get(uploadId);
    if (job) {
      job.status = status;
      job.updatedAt = new Date();
    }
  }
}

export const transferImportProcessor = new TransferImportProcessor();