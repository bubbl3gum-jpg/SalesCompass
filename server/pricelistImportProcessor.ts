import { EventEmitter } from 'events';
import { parse as csvParse } from 'csv-parse';
import * as XLSX from 'xlsx';
import { db } from './db';
import { pricelist } from '@shared/schema';
import { File } from '@google-cloud/storage';

// Job tracking
interface ImportJob {
  uploadId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: {
    phase: 'parsing' | 'validating' | 'writing' | 'done' | 'failed';
    rowsParsed: number;
    rowsValid: number;
    rowsWritten: number;
    rowsFailed: number;
    throughputRps: number;
    eta: number;
  };
  errors: Array<{
    row: number;
    field: string;
    value: any;
    message: string;
  }>;
  startedAt: Date;
  updatedAt: Date;
  errorCsvUrl?: string;
}

class PricelistImportProcessor extends EventEmitter {
  private jobs = new Map<string, ImportJob>();

  constructor() {
    super();
  }

  getJob(uploadId: string): ImportJob | undefined {
    return this.jobs.get(uploadId);
  }

  async startImport(uploadId: string, fileName: string, objectFile: File) {
    const job: ImportJob = {
      uploadId,
      fileName,
      status: 'processing',
      progress: {
        phase: 'parsing',
        rowsParsed: 0,
        rowsValid: 0,
        rowsWritten: 0,
        rowsFailed: 0,
        throughputRps: 0,
        eta: 0
      },
      errors: [],
      startedAt: new Date(),
      updatedAt: new Date()
    };

    this.jobs.set(uploadId, job);
    this.emit('progress', uploadId, job);

    try {
      console.log(`📂 Starting pricelist import for ${fileName}`);
      
      // Download file from object storage
      const [fileBuffer] = await objectFile.download();
      console.log(`📥 Downloaded file, size: ${fileBuffer.length} bytes`);
      
      // Parse file based on extension
      let records: any[] = [];
      const lowerFileName = fileName.toLowerCase();
      
      if (lowerFileName.endsWith('.csv')) {
        records = await this.parseCSV(fileBuffer);
      } else if (lowerFileName.endsWith('.xlsx') || lowerFileName.endsWith('.xls')) {
        records = this.parseExcel(fileBuffer);
      } else {
        throw new Error('Unsupported file format. Please use CSV, XLSX, or XLS files.');
      }

      console.log(`📊 Parsed ${records.length} records`);
      job.progress.rowsParsed = records.length;
      job.progress.phase = 'validating';
      this.emit('progress', uploadId, job);

      // Process records in batches
      const batchSize = 500;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, Math.min(i + batchSize, records.length));
        await this.processBatch(batch, job, i);
        
        job.progress.throughputRps = Math.round(job.progress.rowsWritten / ((Date.now() - job.startedAt.getTime()) / 1000));
        job.progress.eta = Math.round((records.length - job.progress.rowsWritten) / Math.max(1, job.progress.throughputRps));
        job.updatedAt = new Date();
        this.emit('progress', uploadId, job);
      }

      // Generate error CSV if there were errors
      if (job.errors.length > 0) {
        job.errorCsvUrl = await this.generateErrorCsv(job);
      }

      job.status = 'completed';
      job.progress.phase = 'done';
      console.log(`✅ Import completed: ${job.progress.rowsWritten} written, ${job.progress.rowsFailed} failed`);
      this.emit('progress', uploadId, job);

    } catch (error) {
      console.error('❌ Import error:', error);
      job.status = 'failed';
      job.progress.phase = 'failed';
      this.emit('progress', uploadId, job);
    }
  }

  private async parseCSV(buffer: Buffer): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const records: any[] = [];
      let csvString = buffer.toString('utf-8');
      
      // Handle BOM
      if (csvString.charCodeAt(0) === 0xFEFF) {
        csvString = csvString.substr(1);
      }
      
      // Try to detect delimiter
      const firstLine = csvString.split('\n')[0];
      const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
      
      csvParse(csvString, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter,
        relax_quotes: true,
        relax_column_count: true
      })
      .on('data', (data) => {
        // Skip header detection patterns
        const firstValue = Object.values(data)[0] as string;
        if (firstValue && firstValue.toLowerCase().includes('no.baris')) {
          return; // Skip this row
        }
        records.push(data);
      })
      .on('end', () => resolve(records))
      .on('error', reject);
    });
  }

  private parseExcel(buffer: Buffer): any[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Find first non-empty sheet
    let worksheet;
    let sheetName;
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      if (range.e.r > 0) { // Has more than just header
        worksheet = sheet;
        sheetName = name;
        break;
      }
    }
    
    if (!worksheet) {
      worksheet = workbook.Sheets[workbook.SheetNames[0]];
      sheetName = workbook.SheetNames[0];
    }
    
    console.log(`📄 Using sheet: ${sheetName}`);
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      raw: false,
      defval: ''
    });
    
    // Filter out header detection patterns
    return jsonData.filter((row: any) => {
      const firstValue = Object.values(row)[0] as string;
      return !firstValue || !firstValue.toLowerCase().includes('no.baris');
    });
  }

  private async processBatch(batch: any[], job: ImportJob, startIndex: number) {
    const validRecords: any[] = [];

    for (let i = 0; i < batch.length; i++) {
      const record = batch[i];
      const rowIndex = startIndex + i + 2; // +2 for 1-based index and header row

      try {
        // Map columns from various aliases
        const mappedRecord = this.mapColumns(record);
        
        // Debug: Log what we got from mapping
        console.log(`Row ${rowIndex}: mapped normalPrice = "${mappedRecord.normalPrice}"`);
        
        // Validate required fields - only require normal_price to exist and not be empty/zero
        if (!mappedRecord.normalPrice || 
            mappedRecord.normalPrice === '' || 
            mappedRecord.normalPrice === '0' || 
            mappedRecord.normalPrice === 0) {
          job.errors.push({
            row: rowIndex,
            field: 'normal_price',
            value: mappedRecord.normalPrice,
            message: 'Missing or invalid normal_price - record must have a valid price to import'
          });
          job.progress.rowsFailed++;
          continue;
        }

        // Clean and parse prices
        if (mappedRecord.normalPrice) {
          try {
            mappedRecord.normalPrice = this.parsePrice(mappedRecord.normalPrice);
          } catch (e) {
            job.errors.push({
              row: rowIndex,
              field: 'normal_price',
              value: mappedRecord.normalPrice,
              message: 'Invalid number format'
            });
            job.progress.rowsFailed++;
            continue;
          }
        }

        if (mappedRecord.sp) {
          try {
            mappedRecord.sp = this.parsePrice(mappedRecord.sp);
          } catch (e) {
            mappedRecord.sp = null; // Optional field, set to null if invalid
          }
        }

        validRecords.push(mappedRecord);
        job.progress.rowsValid++;

      } catch (error) {
        job.errors.push({
          row: rowIndex,
          field: 'general',
          value: JSON.stringify(record),
          message: error instanceof Error ? error.message : 'Processing error'
        });
        job.progress.rowsFailed++;
      }
    }

    // Insert valid records
    if (validRecords.length > 0) {
      try {
        await db.insert(pricelist).values(validRecords);
        job.progress.rowsWritten += validRecords.length;
        job.progress.phase = 'writing';
      } catch (error) {
        console.error('Database insert error:', error);
        // Add all records in batch to errors
        for (const record of validRecords) {
          job.errors.push({
            row: startIndex + validRecords.indexOf(record) + 2,
            field: 'database',
            value: JSON.stringify(record),
            message: 'Database insert failed'
          });
        }
        job.progress.rowsFailed += validRecords.length;
        job.progress.rowsValid -= validRecords.length;
      }
    }
  }

  private mapColumns(record: any): any {
    const mapped: any = {};

    // Map columns according to spec with exact aliases
    // sn ← aliases: [sn, serial_number, serial no, serial]
    mapped.sn = this.findColumn(record, ['sn', 'serial_number', 'serial no', 'serial']) || null;

    // kode_item ← [kode item, kode_item, item_code, sku, itemcode] - OPTIONAL
    mapped.kodeItem = this.findColumn(record, ['kode item', 'kode_item', 'item_code', 'sku', 'itemcode']) || null;

    // kelompok ← [kelompok, kelompol, group, category_group] - note "kelompol" is valid
    mapped.kelompok = this.findColumn(record, ['kelompok', 'kelompol', 'group', 'category_group']) || null;

    // family ← [family, famili, familia]
    mapped.family = this.findColumn(record, ['family', 'famili', 'familia']) || null;

    // kode_material maps to deskripsiMaterial in DB
    // kode_material ← [kode material, kode_material, material_code]
    mapped.deskripsiMaterial = this.findColumn(record, ['kode material', 'kode_material', 'material_code']) || null;

    // kode_motif ← [kode motif, kode_motif, motif_code, pattern_code]
    mapped.kodeMotif = this.findColumn(record, ['kode motif', 'kode_motif', 'motif_code', 'pattern_code']) || null;

    // nama_motif ← [nama motif, nama_motif, motif_name, pattern_name, nama]
    mapped.namaMotif = this.findColumn(record, ['nama motif', 'nama_motif', 'motif_name', 'pattern_name', 'nama']) || null;

    // normal_price ← [normal price, normal_price, harga normal, harga_normal, price]
    mapped.normalPrice = this.findColumn(record, ['normal price', 'normal_price', 'harga normal', 'harga_normal', 'price']) || '0';

    // SP (special price) - optional
    mapped.sp = this.findColumn(record, ['sp', 'special_price', 'special price', 'harga_khusus', 'harga khusus']) || null;

    return mapped;
  }

  private findColumn(record: any, aliases: string[]): string | undefined {
    for (const key of Object.keys(record)) {
      const normalizedKey = key.toLowerCase().trim().replace(/[\s_-]+/g, ' ');
      for (const alias of aliases) {
        const normalizedAlias = alias.toLowerCase().trim().replace(/[\s_-]+/g, ' ');
        if (normalizedKey === normalizedAlias) {
          const value = record[key];
          if (value === null || value === undefined || value === '') {
            return undefined;
          }
          return String(value).trim();
        }
      }
    }
    return undefined;
  }

  private parsePrice(value: string): string {
    if (!value || value === '0' || value === '') return '0';
    
    // Remove currency symbols and clean up
    let cleaned = value
      .replace(/[Rp$€£¥₹]/gi, '') // Remove currency symbols
      .replace(/\s+/g, '') // Remove spaces
      .trim();
    
    // Handle Indonesian format (1.234.567,89) vs US format (1,234,567.89)
    if (cleaned.includes(',') && cleaned.includes('.')) {
      // Check which is the decimal separator
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');
      
      if (lastComma > lastDot) {
        // Indonesian format: dot is thousands, comma is decimal
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // US format: comma is thousands, dot is decimal
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',')) {
      // Only comma present - could be decimal or thousands
      const commaCount = (cleaned.match(/,/g) || []).length;
      if (commaCount === 1 && cleaned.indexOf(',') === cleaned.length - 3) {
        // Likely decimal separator (e.g., "123,45")
        cleaned = cleaned.replace(',', '.');
      } else {
        // Likely thousands separator
        cleaned = cleaned.replace(/,/g, '');
      }
    }
    // Dots only - assume decimal point
    
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) {
      throw new Error(`Invalid number: ${value}`);
    }
    
    return parsed.toFixed(2);
  }

  private async generateErrorCsv(job: ImportJob): Promise<string> {
    if (job.errors.length === 0) return '';
    
    // Create CSV content
    const csvContent = [
      'row_number,field,original_value,message',
      ...job.errors.map(err => 
        `${err.row},"${err.field}","${err.value || ''}","${err.message}"`
      )
    ].join('\n');
    
    // For now, return as data URL (in production, upload to object storage)
    const base64 = Buffer.from(csvContent).toString('base64');
    return `data:text/csv;base64,${base64}`;
  }
}

export const pricelistImportProcessor = new PricelistImportProcessor();