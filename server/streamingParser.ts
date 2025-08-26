// High-performance streaming parsers for CSV and Excel files
import { Readable, Transform } from 'stream';
import { parse as csvParse } from 'csv-parse';
import * as XLSX from 'xlsx';

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, any>;
  isValid: boolean;
  errors: string[];
}

export interface ParserProgress {
  totalRows: number;
  processedRows: number;
  validRows: number;
  invalidRows: number;
  throughputRps: number;
}

// Streaming CSV parser that doesn't load entire file into memory
export class StreamingCSVParser {
  private rowNumber = 0;
  private startTime = Date.now();
  private lastProgressTime = Date.now();
  private processedRows = 0;

  async *parseStream(buffer: Buffer, tableName: string, jobId: string): AsyncGenerator<ParsedRow, void, unknown> {
    const stream = Readable.from(buffer);
    const parser = csvParse({
      columns: true,
      skip_empty_lines: true,
      skip_lines_with_error: false,
      relax_column_count: true,
      trim: true
    });

    let headerMappings: Record<string, string> = {};

    // Set up column mappings based on table type
    headerMappings = this.getColumnMappings(tableName);

    const self = this; // Capture context for transform function

    const transformStream = new Transform({
      objectMode: true,
      transform(chunk: any, encoding: string, callback: (error?: Error | null, data?: any) => void) {
        try {
          self.rowNumber++;
          const row = self.processRow(chunk, headerMappings, self.rowNumber);
          self.processedRows++;
          
          // Calculate throughput every 1000 rows
          if (self.processedRows % 1000 === 0) {
            const now = Date.now();
            const timeDiff = (now - self.lastProgressTime) / 1000;
            const throughputRps = 1000 / timeDiff;
            self.lastProgressTime = now;
          }
          
          callback(null, row);
        } catch (error) {
          callback(error instanceof Error ? error : new Error(String(error)));
        }
      }
    });

    stream.pipe(parser).pipe(transformStream);

    for await (const row of transformStream) {
      yield row as ParsedRow;
    }
  }

  private processRow(rawRow: any, mappings: Record<string, string>, rowNumber: number): ParsedRow {
    const errors: string[] = [];
    const data: Record<string, any> = {};

    // Map and clean column names
    Object.keys(rawRow).forEach(key => {
      const cleanKey = key.trim().toLowerCase().replace(/\s+/g, ' ');
      const mappedKey = mappings[cleanKey] || mappings[cleanKey.replace(/\s/g, '')];
      
      if (mappedKey) {
        const value = rawRow[key];
        if (value !== null && value !== undefined && value !== '') {
          data[mappedKey] = String(value).trim();
        }
      }
    });

    // Basic validation
    const isValid = this.validateRow(data, errors, rowNumber);

    return {
      rowNumber,
      data,
      isValid,
      errors
    };
  }

  private validateRow(data: Record<string, any>, errors: string[], rowNumber: number): boolean {
    // Add table-specific validation rules
    if (!data.kodeItem && !data.nik && !data.kodeGudang) {
      errors.push(`Row ${rowNumber}: Missing required identifier`);
      return false;
    }

    return true;
  }

  private getColumnMappings(tableName: string): Record<string, string> {
    const mappings: Record<string, Record<string, string>> = {
      'reference-sheet': {
        'kode item': 'kodeItem',
        'kodeitem': 'kodeItem',
        'item code': 'kodeItem',
        'nama item': 'namaItem',
        'namaitem': 'namaItem',
        'item name': 'namaItem',
        'kelompok': 'kelompok',
        'group': 'kelompok',
        'family': 'family',
        'original code': 'originalCode',
        'color': 'color',
        'warna': 'color',
        'kode material': 'kodeMaterial',
        'material code': 'kodeMaterial',
        'deskripsi material': 'deskripsiMaterial',
        'material description': 'deskripsiMaterial',
        'kode motif': 'kodeMotif',
        'motif code': 'kodeMotif',
        'deskripsi motif': 'deskripsiMotif',
        'motif description': 'deskripsiMotif'
      },
      'staff': {
        'nik': 'nik',
        'employee id': 'nik',
        'email': 'email',
        'nama': 'nama',
        'name': 'nama',
        'no telepon': 'noTelepon',
        'phone': 'noTelepon',
        'position id': 'positionId',
        'jabatan': 'positionId',
        'store access': 'storeAccess',
        'akses gudang': 'storeAccess',
        'kode gudang': 'kodeGudang',
        'store code': 'kodeGudang'
      },
      'stores': {
        'kode gudang': 'kodeGudang',
        'store code': 'kodeGudang',
        'nama gudang': 'namaGudang',
        'store name': 'namaGudang',
        'jenis gudang': 'jenisGudang',
        'store type': 'jenisGudang',
        'username': 'storeUsername',
        'store username': 'storeUsername',
        'password': 'storePassword',
        'store password': 'storePassword'
      },
      'pricelist': {
        'kode item': 'kodeItem',
        'item code': 'kodeItem',
        'kode gudang': 'kodeGudang',
        'store code': 'kodeGudang',
        'harga beli': 'hargaBeli',
        'cost price': 'hargaBeli',
        'harga jual': 'hargaJual',
        'selling price': 'hargaJual'
      },
      'transfer-items': {
        's/n': 'sn',
        'serial': 'sn',
        'serial number': 'sn',
        'kode item': 'kodeItem',
        'item code': 'kodeItem',
        'nama item': 'namaItem',
        'item name': 'namaItem',
        'qty': 'qty',
        'quantity': 'qty',
        'qty transfer': 'qty',
        'satuan': 'unit',
        'unit': 'unit'
      },
      'stock-opname-items': {
        's/n': 'sn',
        'serial': 'sn',
        'kode item': 'kodeItem',
        'item code': 'kodeItem',
        'nama item': 'namaItem',
        'item name': 'namaItem',
        'qty system': 'qtySystem',
        'qty actual': 'qtyActual',
        'system qty': 'qtySystem',
        'actual qty': 'qtyActual'
      }
    };

    return mappings[tableName] || {};
  }
}

// Streaming Excel parser with memory optimization
export class StreamingExcelParser {
  async *parseStream(buffer: Buffer, tableName: string, jobId: string): AsyncGenerator<ParsedRow, void, unknown> {
    try {
      // Read workbook but don't convert to full JSON yet
      const workbook = XLSX.read(buffer, { 
        type: 'buffer',
        sheetStubs: false, // Skip empty cells
        cellFormula: false, // Don't process formulas
        cellHTML: false // Don't process HTML
      });
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      if (!worksheet) {
        throw new Error('No valid worksheet found');
      }

      // Get range to process rows in chunks
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      
      let headerRow: string[] = [];
      let headerMappings: Record<string, string> = {};
      let headerRowIndex = -1;
      let toNumber: string | null = null;
      
      // Extract TO number from early rows (typically row 6 for transfer files)
      if (tableName === 'transfer-items') {
        for (let rowNum = range.s.r; rowNum <= Math.min(range.s.r + 10, range.e.r); rowNum++) {
          const row: any[] = [];
          for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
            const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
            const cell = worksheet[cellAddress];
            row.push(cell ? String(cell.v || '').trim() : '');
          }
          
          const rowText = row.join(' ');
          // Look for TO number pattern like "Untuk Nomor TO|Seq: 2508-091  -01"
          const toMatch = rowText.match(/(?:Untuk\s+Nomor\s+TO|TO|Seq).*?([A-Z0-9\-\s]{8,20})/i);
          if (toMatch && toMatch[1]) {
            toNumber = toMatch[1].trim();
            console.log(`Extracted TO Number: ${toNumber} from row ${rowNum + 1}`);
            break;
          }
        }
      }

      // Find header row
      for (let rowNum = range.s.r; rowNum <= Math.min(range.s.r + 10, range.e.r); rowNum++) {
        const row: any[] = [];
        for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
          const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
          const cell = worksheet[cellAddress];
          row.push(cell ? String(cell.v || '').trim() : '');
        }
        
        const rowText = row.join(' ').toLowerCase();
        if (this.isHeaderRow(rowText, tableName)) {
          headerRow = row.filter(h => h);
          headerRowIndex = rowNum;
          headerMappings = this.createHeaderMappings(headerRow, tableName);
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error('Header row not found');
      }

      // Process data rows in chunks for memory efficiency
      const chunkSize = 1000;
      let rowNumber = 0;
      
      for (let startRow = headerRowIndex + 1; startRow <= range.e.r; startRow += chunkSize) {
        const endRow = Math.min(startRow + chunkSize - 1, range.e.r);
        
        for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
          const row: any[] = [];
          for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
            const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
            const cell = worksheet[cellAddress];
            row.push(cell ? String(cell.v || '').trim() : '');
          }

          // Skip empty rows
          if (row.every(cell => !cell)) continue;

          rowNumber++;
          const parsedRow = this.processRow(row, headerRow, headerMappings, rowNumber, toNumber);
          yield parsedRow;
        }
      }
    } catch (error) {
      throw new Error(`Excel parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private isHeaderRow(rowText: string, tableName: string): boolean {
    const identifiers: Record<string, string[]> = {
      'reference-sheet': ['kode item', 'nama item', 'item code'],
      'staff': ['nik', 'email', 'nama'],
      'stores': ['kode gudang', 'nama gudang', 'store code'],
      'pricelist': ['kode item', 'harga', 'price'],
      'transfer-items': ['s/n', 'kode item', 'nama item', 'qty transfer', 'serial', 'item code'],
      'stock-opname-items': ['s/n', 'kode item', 'nama item', 'qty system', 'qty actual']
    };

    const tableIdentifiers = identifiers[tableName] || [];
    return tableIdentifiers.some(id => rowText.includes(id));
  }

  private createHeaderMappings(headers: string[], tableName: string): Record<string, string> {
    const csvParser = new StreamingCSVParser();
    const mappings = csvParser['getColumnMappings'](tableName);
    
    const headerMappings: Record<string, string> = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.trim().toLowerCase();
      const mappedKey = mappings[cleanHeader] || mappings[cleanHeader.replace(/\s/g, '')];
      if (mappedKey) {
        headerMappings[index.toString()] = mappedKey;
      }
    });

    return headerMappings;
  }

  private processRow(row: any[], headers: string[], mappings: Record<string, string>, rowNumber: number, toNumber?: string | null): ParsedRow {
    const errors: string[] = [];
    const data: Record<string, any> = {};

    row.forEach((value, index) => {
      const mappedKey = mappings[index.toString()];
      if (mappedKey && value && value !== '') {
        data[mappedKey] = String(value).trim();
      }
    });

    const isValid = Object.keys(data).length > 0;
    if (!isValid) {
      errors.push(`Row ${rowNumber}: No valid data found`);
    }

    // Add TO number to transfer items
    if (toNumber && data) {
      data.toNumber = toNumber;
    }

    return {
      rowNumber,
      data,
      isValid,
      errors
    };
  }
}