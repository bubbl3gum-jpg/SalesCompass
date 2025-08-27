import { EventEmitter } from 'events';
import { parse as csvParse } from 'csv-parse';
import * as XLSX from 'xlsx';
import { db } from './db';
import { pricelist } from '@shared/schema';

// In-memory job storage for import progress tracking
const jobs = new Map<string, PricelistImportJob>();

export interface PricelistImportJob {
  uploadId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: {
    phase: 'parsing' | 'validating' | 'writing' | 'done' | 'failed';
    uploadProgress: number;
    rowsParsed: number;
    rowsValid: number;
    rowsFailed: number;
    rowsWritten: number;
    throughputRps?: number;
    eta?: number;
  };
  errors: string[];
  startedAt: Date;
  updatedAt: Date;
}

export class PricelistImportProcessor extends EventEmitter {
  constructor() {
    super();
  }

  // Start processing a pricelist import job
  async startImport(uploadId: string, fileName: string, objectFile: any): Promise<void> {
    console.log(`🚀 Starting pricelist import job: ${uploadId}`);

    // Initialize job
    const job: PricelistImportJob = {
      uploadId,
      status: 'processing',
      progress: {
        phase: 'parsing',
        uploadProgress: 100, // File already uploaded
        rowsParsed: 0,
        rowsValid: 0,
        rowsFailed: 0,
        rowsWritten: 0
      },
      errors: [],
      startedAt: new Date(),
      updatedAt: new Date()
    };
    
    jobs.set(uploadId, job);
    this.emitProgress(uploadId);

    try {
      // Parse file
      const stream = objectFile.createReadStream();
      const records = await this.parseFile(stream, fileName, uploadId);
      
      // Update progress
      job.progress.rowsParsed = records.length;
      job.progress.phase = 'validating';
      this.emitProgress(uploadId);

      // Filter out header rows first
      const dataRecords = this.filterHeaderRows(records, uploadId);
      
      // Validate and process records
      const validRecords = await this.validateRecords(dataRecords, uploadId);
      
      // Update progress
      job.progress.rowsValid = validRecords.length;
      job.progress.rowsFailed = dataRecords.length - validRecords.length;
      job.progress.phase = 'writing';
      this.emitProgress(uploadId);

      // Batch write to database
      await this.writeToDatabase(validRecords, job, uploadId);
      
      // Complete
      job.status = 'completed';
      job.progress.phase = 'done';
      job.progress.rowsWritten = validRecords.length;
      job.updatedAt = new Date();
      this.emitProgress(uploadId);

      console.log(`✅ Pricelist import job ${uploadId} completed: ${validRecords.length} records`);

    } catch (error) {
      console.error(`❌ Pricelist import job ${uploadId} failed:`, error);
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

  // Filter out header rows - skip rows containing column headers like "sn, kode item, normal price"
  private filterHeaderRows(records: any[], uploadId: string): any[] {
    console.log(`🔍 Filtering header rows from ${records.length} records...`);
    
    // Look for header patterns that indicate column names
    const headerPatterns = [
      'sn', 's/n', 'serial', 'serial number',
      'kode item', 'kodeitem', 'item code', 'sku',
      'kelompok', 'group', 'category',
      'family', 'famili', 'familia',
      'kode material', 'kodematerial', 'material code', 'kode_material',
      'kode motif', 'kodemotif', 'motif code', 'pattern code',
      'nama motif', 'namamotif', 'motif name', 'pattern name',
      'normal price', 'normalprice', 'harga normal', 'price'
    ];
    
    let headerRowIndex = -1;
    
    // Find the first row that looks like a header row
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const recordValues = Object.values(record).map(v => 
        (v?.toString() || '').toLowerCase().trim().replace(/[\s_-]/g, '')
      );
      
      // Check if this row contains header-like values
      let headerMatches = 0;
      for (const pattern of headerPatterns) {
        const normalizedPattern = pattern.toLowerCase().replace(/[\s_-]/g, '');
        if (recordValues.some(value => value === normalizedPattern || value.includes(normalizedPattern))) {
          headerMatches++;
        }
      }
      
      // If we found at least 4 header pattern matches, consider this a header row
      if (headerMatches >= 4) {
        headerRowIndex = i;
        console.log(`📋 Found header row at index ${i}:`, record);
        break;
      }
    }
    
    if (headerRowIndex >= 0) {
      // Return only records after the header row
      const dataRecords = records.slice(headerRowIndex + 1);
      console.log(`✂️ Skipped ${headerRowIndex + 1} rows (including headers), processing ${dataRecords.length} data rows`);
      return dataRecords;
    } else {
      console.log(`📋 No header row detected, processing all ${records.length} rows`);
      return records;
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

    console.log(`🔍 Validating ${records.length} records...`);
    console.log(`📋 Sample record keys:`, Object.keys(records[0] || {}));

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      // Map columns with aliases - canonical order: sn, kode_item, kelompok, family, kode_material, kode_motif, nama_motif, normal_price
      // Normalize header names (case-insensitive, space/underscore tolerant)
      const normalizeKey = (obj: any, aliases: string[]): string => {
        for (const key of Object.keys(obj)) {
          const normalizedKey = key.toLowerCase().replace(/[\s_-]/g, '');
          for (const alias of aliases) {
            if (normalizedKey === alias.toLowerCase().replace(/[\s_-]/g, '')) {
              return obj[key]?.toString().trim() || '';
            }
          }
        }
        return '';
      };

      // Parse and clean numeric values
      const parsePrice = (value: string): number | null => {
        if (!value || value.trim() === '') return null;
        
        // Remove currency symbols, spaces, and separators
        const cleaned = value.toString()
          .replace(/[Rp\s,.']/g, '')
          .replace(/[^\d.-]/g, '');
          
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? null : parsed;
      };

      const mappedRecord = {
        sn: normalizeKey(record, ['sn', 's/n', 'serial_number', 'serial no', 'serial', 'serialnumber']) || null,
        kodeItem: normalizeKey(record, ['kode_item', 'kode item', 'item_code', 'sku', 'itemcode', 'code']),
        kelompok: normalizeKey(record, ['kelompok', 'kelompol', 'group', 'category_group']) || null,
        family: normalizeKey(record, ['family', 'famili', 'familia']) || null,
        // Map kode_material to deskripsiMaterial (DB column name)
        deskripsiMaterial: normalizeKey(record, ['kode_material', 'kode material', 'material_code', 'deskripsi_material', 'deskripsi material']) || null,
        kodeMotif: normalizeKey(record, ['kode_motif', 'kode motif', 'motif_code', 'pattern_code']) || null,
        namaMotif: normalizeKey(record, ['nama_motif', 'nama motif', 'motif_name', 'pattern_name', 'nama']) || null,
        normalPrice: parsePrice(normalizeKey(record, ['normal_price', 'normal price', 'harga_normal', 'harga normal', 'price']))
      };

      console.log(`📝 Record ${i + 1}:`, { original: record, mapped: mappedRecord });

      // Validate required fields
      if (!mappedRecord.kodeItem) {
        console.log(`❌ Record ${i + 1} invalid - missing kode_item:`, mappedRecord);
        job.progress.rowsFailed++;
      } else {
        validRecords.push(mappedRecord);
        console.log(`✅ Record ${i + 1} valid:`, mappedRecord);
      }

      // Update progress every 1000 records
      if (i % 1000 === 0 && i > 0) {
        job.progress.rowsParsed = i;
        this.calculateThroughput(job);
        this.emitProgress(uploadId);
      }
    }

    console.log(`📊 Validation complete: ${validRecords.length} valid out of ${records.length}`);
    return validRecords;
  }

  // Write records to database in batches
  private async writeToDatabase(records: any[], job: PricelistImportJob, uploadId: string): Promise<void> {
    const jobData = jobs.get(uploadId);
    if (!jobData) throw new Error(`Job ${uploadId} not found`);

    console.log(`💾 Writing ${records.length} records to database`);

    const batchSize = 1000; // Smaller batches for better error handling
    let written = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const insertData = batch.map(record => ({
        sn: record.sn,
        kodeItem: record.kodeItem,
        kelompok: record.kelompok,
        family: record.family,
        deskripsiMaterial: record.deskripsiMaterial,
        kodeMotif: record.kodeMotif,
        namaMotif: record.namaMotif,
        normalPrice: record.normalPrice ? record.normalPrice.toString() : null,
        sp: null // Not in import requirements
      }));

      console.log(`📝 Writing batch ${i / batchSize + 1} with ${batch.length} records...`);
      console.log(`📋 Sample insert data:`, insertData[0]);

      try {
        const result = await db.insert(pricelist).values(insertData).returning();
        written += result.length;
        
        console.log(`✅ Batch ${i / batchSize + 1} written successfully: ${result.length} rows`);

        // Update progress
        jobData.progress.rowsWritten = written;
        this.calculateThroughput(jobData);
        this.emitProgress(uploadId);

      } catch (error) {
        console.error(`❌ Batch ${i / batchSize + 1} failed:`, error);
        throw error;
      }
    }

    console.log(`📊 Progress: ${written}/${records.length} records written`);
    console.log(`🎉 All ${written} records written successfully!`);
  }

  // Calculate throughput metrics
  private calculateThroughput(job: PricelistImportJob): void {
    const elapsed = Date.now() - job.startedAt.getTime();
    const elapsedSeconds = elapsed / 1000;
    
    if (elapsedSeconds > 0) {
      job.progress.throughputRps = job.progress.rowsWritten / elapsedSeconds;
      
      const remaining = job.progress.rowsValid - job.progress.rowsWritten;
      if (job.progress.throughputRps > 0) {
        job.progress.eta = remaining / job.progress.throughputRps;
      }
    }
  }

  // Emit progress update via Server-Sent Events
  private emitProgress(uploadId: string): void {
    const job = jobs.get(uploadId);
    if (job) {
      this.emit('progress', uploadId, job);
    }
  }

  // Get job status
  getJob(uploadId: string): PricelistImportJob | undefined {
    return jobs.get(uploadId);
  }

  // Clean up completed jobs (called periodically)
  cleanup(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    for (const [uploadId, job] of jobs.entries()) {
      if (job.updatedAt.getTime() < cutoff) {
        jobs.delete(uploadId);
      }
    }
  }
}

// Singleton instance
export const pricelistImportProcessor = new PricelistImportProcessor();

// Cleanup interval
setInterval(() => pricelistImportProcessor.cleanup(), 60 * 60 * 1000); // Every hour