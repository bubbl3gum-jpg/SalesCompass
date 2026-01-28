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
  toNumber: string;
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
  
  // Extract TO number from the first column of the file  
  extractToNumber(records: any[], fileName?: string): string | null {
    // Look for different patterns of TO number in the first column
    const patterns = [
      // Original format: "Untuk nomor TO: 2509-249"
      /untuk\s*nomor\s*to\s*:\s*(.+)/i,
      // New format: "Untuk Nomor TO|Seq: 2509-108  -01" - extract the TO number part
      /untuk\s*nomor\s*to\s*\|\s*seq\s*:\s*(\d{4}-\d{3})/i,
      // Broader pattern to catch TO numbers in various formats
      /untuk\s*nomor\s*to[|:\s]*(?:seq\s*:\s*)?(\d{4}-\d{3})/i
    ];
    
    for (const record of records) {
      const keys = Object.keys(record);
      if (keys.length > 0) {
        const firstColValue = record[keys[0]];
        if (firstColValue && typeof firstColValue === 'string') {
          console.log(`🔍 Checking first column value: "${firstColValue}"`);
          
          // Try each pattern
          for (const pattern of patterns) {
            const match = firstColValue.match(pattern);
            if (match && match[1]) {
              const toNumber = match[1].trim();
              console.log(`📋 TO number extracted from file content: ${toNumber}`);
              return toNumber;
            }
          }
        }
      }
    }
    
    // Fallback: Try to extract TO number from filename
    // Look for patterns like "2509-249.xlsx" or "TO-2509-249.csv" etc.
    if (fileName) {
      const fileNamePattern = /(\d{4}-\d{3})/;
      const fileNameMatch = fileName.match(fileNamePattern);
      if (fileNameMatch && fileNameMatch[1]) {
        console.log(`📋 TO number extracted from filename: ${fileNameMatch[1]}`);
        return fileNameMatch[1].trim();
      }
    }
    
    return null;
  }
  
  // Create new import job
  createJob(params: {
    uploadId: string;
    fileKey: string;
    fileName: string;
    fileSize: number;
    fileSha256: string;
    toNumber: string;
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

  // Filter out header rows - skip rows containing column headers like "no.baris, sn, kode item, qty"
  private filterHeaderRows(records: any[], uploadId: string): any[] {
    console.log(`🔍 Filtering header rows from ${records.length} records...`);
    
    // Look for header patterns that indicate column names
    const headerPatterns = [
      'no.baris', 'no baris', 'nobaris',
      'sn', 's/n',
      'kode item', 'kodeitem', 'item code',
      'qty', 'quantity', 'jumlah'
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
      
      // If we found at least 3 header pattern matches, consider this a header row
      if (headerMatches >= 3) {
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

  // Parse Excel file with intelligent header detection
  private async parseExcel(stream: NodeJS.ReadableStream, uploadId: string): Promise<any[]> {
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Parse as array of arrays to find header row
          const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          
          console.log(`📊 Excel raw rows: ${rawData.length}`);
          
          // Find the header row by searching for known column headers
          const headerKeywords = {
            kodeItem: ['kode item', 'kode_item', 'item_code', 'itemcode', 'sku', 'code', 'kode'],
            namaItem: ['nama item', 'nama_item', 'item_name', 'itemname', 'nama barang', 'nama', 'description', 'product name'],
            sn: ['s/n', 'sn', 'serial', 'serial_number', 'serial number', 'serialno'],
            qty: ['q to tran', 'qty', 'quantity', 'jumlah', 'qtt', 'q to transfer']
          };
          
          let headerRowIndex = -1;
          let columnMap: { [key: string]: number } = {};
          
          // Scan each row to find the header row
          for (let rowIdx = 0; rowIdx < Math.min(rawData.length, 20); rowIdx++) {
            const row = rawData[rowIdx];
            if (!row || row.length === 0) continue;
            
            let tempColumnMap: { [key: string]: number } = {};
            let foundColumns = 0;
            
            for (let colIdx = 0; colIdx < row.length; colIdx++) {
              const cellValue = String(row[colIdx] || '').toLowerCase().trim();
              if (!cellValue) continue;
              
              // Check if this cell matches any header keyword
              for (const [fieldName, keywords] of Object.entries(headerKeywords)) {
                if (keywords.some(kw => cellValue === kw || cellValue.includes(kw))) {
                  tempColumnMap[fieldName] = colIdx;
                  foundColumns++;
                  break;
                }
              }
            }
            
            // Need at least 2 columns matched to consider it a header row
            if (foundColumns >= 2) {
              headerRowIndex = rowIdx;
              columnMap = tempColumnMap;
              console.log(`🎯 Found header row at index ${rowIdx}:`, row);
              console.log(`📍 Column mapping:`, columnMap);
              break;
            }
          }
          
          if (headerRowIndex === -1) {
            // Fall back to default behavior
            console.log(`⚠️ No header row found, using default parsing`);
            const records = XLSX.utils.sheet_to_json(worksheet);
            resolve(records);
            return;
          }
          
          // Extract data rows after the header
          const records: any[] = [];
          for (let rowIdx = headerRowIndex + 1; rowIdx < rawData.length; rowIdx++) {
            const row = rawData[rowIdx];
            if (!row || row.length === 0) continue;
            
            // Skip empty rows or rows that look like footers
            const firstCell = String(row[0] || '').toLowerCase().trim();
            if (firstCell.includes('printed') || firstCell.includes('total') || firstCell.includes('page')) {
              console.log(`⏭️ Skipping footer row ${rowIdx}:`, firstCell);
              continue;
            }
            
            // Build record from column mapping
            const record: any = {
              kodeItem: columnMap.kodeItem !== undefined ? String(row[columnMap.kodeItem] || '').trim() : '',
              namaItem: columnMap.namaItem !== undefined ? String(row[columnMap.namaItem] || '').trim() : '',
              sn: columnMap.sn !== undefined ? String(row[columnMap.sn] || '').trim() : '',
              qty: 1 // Default
            };
            
            // Parse qty - could be in different format
            if (columnMap.qty !== undefined) {
              const qtyVal = row[columnMap.qty];
              if (qtyVal !== undefined && qtyVal !== null && qtyVal !== '') {
                const parsed = parseFloat(String(qtyVal));
                record.qty = isNaN(parsed) ? 1 : Math.round(parsed);
              }
            }
            
            // Only include if we have at least some data
            if (record.kodeItem || record.namaItem || record.sn) {
              records.push(record);
            }
          }
          
          console.log(`📊 Excel parsed: ${records.length} data records (header at row ${headerRowIndex + 1})`);
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
      
      // Map columns with aliases - canonical order: sn, kode_item, nama_item, qty
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

      // Find qty column - look for numeric columns with reasonable values (1-99999)
      // __EMPTY_4 is typically the quantity column in the Excel format
      const findQtyValue = (obj: any): number => {
        // First try explicit qty column names
        for (const key of Object.keys(obj)) {
          const normalizedKey = key.toLowerCase().replace(/[\s_-]/g, '');
          if (['qtotran', 'qty', 'quantity', 'jumlah'].includes(normalizedKey)) {
            const val = parseInt(obj[key]?.toString() || '1');
            if (!isNaN(val) && val > 0 && val < 100000) return val;
          }
        }
        // Then check __EMPTY_4 (typical qty position in Excel exports)
        if (obj.__EMPTY_4 !== undefined) {
          const val = parseInt(obj.__EMPTY_4?.toString() || '1');
          if (!isNaN(val) && val > 0 && val < 100000) return val;
        }
        // Fallback to columns with small numeric values
        for (const key of Object.keys(obj)) {
          if (key.startsWith('__EMPTY')) {
            const val = parseInt(obj[key]?.toString() || '');
            if (!isNaN(val) && val > 0 && val < 100000) return val;
          }
        }
        return 1;
      };

      const mappedRecord = {
        lineNo: parseInt(normalizeKey(record, ['no. baris', 'no baris', 'line no', 'line_no', 'row no', 'row_no', 'PT. RANCANG INDAH SENTOSA']) || '0') || null,
        sn: normalizeKey(record, ['s/n', 'sn', 'serial_number', 'serial no', 'serial', 'serialno', '__EMPTY_2']),
        kodeItem: normalizeKey(record, ['kode_item', 'kode item', 'item_code', 'sku', 'itemcode', 'code', '__EMPTY']),
        namaItem: normalizeKey(record, ['nama_item', 'nama item', 'item_name', 'nama', 'itemname', 'product name', 'description', '__EMPTY_1']) || null,
        qty: findQtyValue(record)
      };

      console.log(`📝 Record ${i + 1}:`, { original: record, mapped: mappedRecord });

      // Skip header rows - check if values look like headers
      const headerKeywords = ['kode', 'nama', 'item', 'barang', 'qty', 'quantity', 'serial', 's/n', 'sc', 'no.', 'jumlah'];
      const isHeaderRow = headerKeywords.some(keyword => {
        const kodeItemLower = (mappedRecord.kodeItem || '').toLowerCase().trim();
        const namaItemLower = (mappedRecord.namaItem || '').toLowerCase().trim();
        const snLower = (mappedRecord.sn || '').toLowerCase().trim();
        return kodeItemLower === keyword || namaItemLower.startsWith(keyword) || snLower === keyword;
      });
      
      if (isHeaderRow) {
        console.log(`⏭️ Record ${i + 1} skipped - looks like header row:`, mappedRecord);
        job.progress.rowsFailed++;
        continue;
      }

      // More lenient validation - accept any record with at least one field
      if (mappedRecord.sn || mappedRecord.kodeItem || mappedRecord.namaItem) {
        validRecords.push(mappedRecord);
        console.log(`✅ Record ${i + 1} valid:`, mappedRecord);
      } else {
        // Check if it's a data row by checking first column has a numeric value
        const firstCol = record['PT. RANCANG INDAH SENTOSA'];
        if (firstCol && !isNaN(parseInt(firstCol))) {
          // It's a data row with mismatched headers, extract directly from __EMPTY columns
          // Use __EMPTY_4 for qty (not __EMPTY_3 which contains serial codes)
          const fixedRecord = {
            lineNo: parseInt(firstCol) || null,
            sn: record.__EMPTY_2 || '',
            kodeItem: record.__EMPTY || '',
            namaItem: record.__EMPTY_1 || null,
            qty: findQtyValue(record)
          };
          if (fixedRecord.sn || fixedRecord.kodeItem) {
            validRecords.push(fixedRecord);
            console.log(`✅ Record ${i + 1} fixed and valid:`, fixedRecord);
          } else {
            console.log(`❌ Record ${i + 1} invalid - empty fixed record:`, fixedRecord);
            job.progress.rowsFailed++;
          }
        } else {
          console.log(`❌ Record ${i + 1} invalid - completely empty record:`, mappedRecord);
          job.progress.rowsFailed++;
        }
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
  private async writeToDatabase(records: any[], job: TransferImportJob, uploadId: string): Promise<void> {
    const jobData = jobs.get(uploadId);
    if (!jobData) throw new Error(`Job ${uploadId} not found`);

    const toNumber = job.toNumber;
    console.log(`💾 Writing ${records.length} records to database for TO: ${toNumber}`);

    const batchSize = 100; // Smaller batches for reliability
    let written = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const insertData = batch.map(record => ({
        toNumber,
        lineNo: record.lineNo,
        sn: record.sn || null,
        kodeItem: record.kodeItem || null,
        namaItem: record.namaItem || null,
        qty: record.qty || 1
      }));

      console.log(`📝 Writing batch ${Math.floor(i / batchSize) + 1} with ${batch.length} records...`);
      if (i === 0) {
        console.log(`📋 Sample insert data:`, insertData[0]);
      }

      try {
        // Use simple insert without returning for performance
        await db.insert(toItemList).values(insertData);
        written += batch.length;
        
        console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} written: ${batch.length} rows (total: ${written})`);
        
        // Update progress
        jobData.progress.rowsWritten = written;
        this.calculateThroughput(job);
        this.emitProgress(uploadId);
      } catch (error) {
        console.error(`❌ Batch write error for batch ${Math.floor(i / batchSize) + 1}:`, error);
        console.error(`📋 Failed insert data sample:`, insertData[0]);
        throw error;
      }
    }

    console.log(`🎉 All ${written} records written successfully!`);
  }

  // Calculate throughput and ETA
  private calculateThroughput(jobData: TransferImportJob): void {
    const now = new Date();
    const elapsed = (now.getTime() - jobData.progress.startedAt.getTime()) / 1000;
    
    if (elapsed > 0) {
      jobData.progress.throughputRps = Math.round(jobData.progress.rowsParsed / elapsed);
      
      const remaining = jobData.progress.rowsTotal - jobData.progress.rowsParsed;
      if (jobData.progress.throughputRps > 0) {
        jobData.progress.etaSeconds = Math.round(remaining / jobData.progress.throughputRps);
      }
    }
    
    jobData.progress.updatedAt = now;
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