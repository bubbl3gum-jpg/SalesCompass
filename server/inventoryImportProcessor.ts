import { parse as csvParse } from 'csv-parse';
import * as XLSX from 'xlsx';

export interface InventoryImportItem {
  sn: string;
  kodeItem?: string | null;
  sc?: string | null;
  namaBarang?: string | null;
  qty: number;
}

export interface InventoryImportResult {
  success: boolean;
  items: InventoryImportItem[];
  errors: string[];
  headerRowIndex: number;
}

const COLUMN_ALIASES = {
  sn: [
    's/n', 'sn', 'serial', 'serial_number', 'serial number', 'serialno', 
    'serial no', 'nomor serial', 'no. seri', 'no seri', 'noseri'
  ],
  kodeItem: [
    'kode item', 'kode_item', 'item_code', 'item code', 'itemcode', 'sku', 
    'code', 'kode', 'product code', 'productcode', 'kode barang', 'kode_barang',
    'kodebarang', 'item_kode', 'kode produk'
  ],
  sc: [
    'sc', 'serial code', 'serial_code', 'serialcode', 'kode serial', 
    'kode_serial', 'kodeserial', 'series code', 'seriescode'
  ],
  namaBarang: [
    'nama barang', 'nama_barang', 'namabarang', 'nama item', 'nama_item',
    'namaitem', 'item name', 'item_name', 'itemname', 'product name',
    'product_name', 'productname', 'nama', 'description', 'deskripsi',
    'nama produk', 'nama_produk', 'namaproduk'
  ],
  qty: [
    'qty', 'quantity', 'jumlah', 'qtt', 'q', 'kuantitas', 'stok', 'stock',
    'amount', 'count', 'banyak', 'unit', 'pcs'
  ]
};

function normalizeString(str: string): string {
  return str.toLowerCase().replace(/[\s_\-\.]/g, '').trim();
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const normalizedHeader = normalizeString(headers[i]);
    for (const alias of aliases) {
      if (normalizedHeader === normalizeString(alias)) {
        return i;
      }
    }
  }
  return -1;
}

function isHeaderRow(row: string[]): boolean {
  let matchCount = 0;
  for (const cell of row) {
    if (!cell) continue;
    const normalized = normalizeString(String(cell));
    for (const aliases of Object.values(COLUMN_ALIASES)) {
      for (const alias of aliases) {
        if (normalized === normalizeString(alias)) {
          matchCount++;
          break;
        }
      }
    }
  }
  return matchCount >= 2;
}

function detectFileType(buffer: Buffer, fileName: string): 'excel' | 'csv' | 'unknown' {
  const excelExtensions = ['.xlsx', '.xls', '.xlsm'];
  const csvExtensions = ['.csv', '.txt'];
  
  const lowerFileName = fileName.toLowerCase();
  
  if (excelExtensions.some(ext => lowerFileName.endsWith(ext))) {
    return 'excel';
  }
  if (csvExtensions.some(ext => lowerFileName.endsWith(ext))) {
    return 'csv';
  }
  
  // Check magic bytes
  if (buffer.length >= 4) {
    const sig = buffer.slice(0, 4).toString('hex');
    if (sig === '504b0304') return 'excel'; // PK ZIP (XLSX)
    if (sig.startsWith('d0cf11e0')) return 'excel'; // OLE (XLS)
  }
  
  // Try to detect CSV by content
  const content = buffer.toString('utf-8', 0, Math.min(1000, buffer.length));
  if (content.includes(',') || content.includes('\t')) {
    return 'csv';
  }
  
  return 'unknown';
}

export async function parseInventoryFile(buffer: Buffer, fileName: string): Promise<InventoryImportResult> {
  const fileType = detectFileType(buffer, fileName);
  console.log(`📁 Detected file type: ${fileType} for ${fileName}`);
  
  if (fileType === 'excel') {
    return parseExcelBuffer(buffer);
  } else if (fileType === 'csv') {
    return parseCSVBuffer(buffer);
  } else {
    return {
      success: false,
      items: [],
      errors: ['Unknown file type. Please upload CSV or Excel file.'],
      headerRowIndex: -1
    };
  }
}

function parseExcelBuffer(buffer: Buffer): InventoryImportResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    return parseRows(jsonData);
  } catch (error: any) {
    return {
      success: false,
      items: [],
      errors: [`Excel parse error: ${error.message}`],
      headerRowIndex: -1
    };
  }
}

async function parseCSVBuffer(buffer: Buffer): Promise<InventoryImportResult> {
  return new Promise((resolve) => {
    const content = buffer.toString('utf-8');
    const rows: string[][] = [];
    
    const parser = csvParse({
      delimiter: [',', ';', '\t'],
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true
    });
    
    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        rows.push(record);
      }
    });
    
    parser.on('error', (err) => {
      resolve({
        success: false,
        items: [],
        errors: [`CSV parse error: ${err.message}`],
        headerRowIndex: -1
      });
    });
    
    parser.on('end', () => {
      resolve(parseRows(rows));
    });
    
    parser.write(content);
    parser.end();
  });
}

function parseRows(rows: any[][]): InventoryImportResult {
  const errors: string[] = [];
  const items: InventoryImportItem[] = [];
  
  // Find header row (scan first 20 rows)
  let headerRowIndex = -1;
  let headers: string[] = [];
  
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i].map(cell => String(cell || ''));
    if (isHeaderRow(row)) {
      headerRowIndex = i;
      headers = row;
      console.log(`📋 Header row found at index ${i}:`, row);
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    return {
      success: false,
      items: [],
      errors: ['Could not find header row. Make sure your file has column headers like SN, Kode Item, Nama Barang, Qty.'],
      headerRowIndex: -1
    };
  }
  
  // Map columns
  const columnMap = {
    sn: findColumnIndex(headers, COLUMN_ALIASES.sn),
    kodeItem: findColumnIndex(headers, COLUMN_ALIASES.kodeItem),
    sc: findColumnIndex(headers, COLUMN_ALIASES.sc),
    namaBarang: findColumnIndex(headers, COLUMN_ALIASES.namaBarang),
    qty: findColumnIndex(headers, COLUMN_ALIASES.qty)
  };
  
  console.log(`📊 Column mapping:`, columnMap);
  
  if (columnMap.sn === -1) {
    return {
      success: false,
      items: [],
      errors: ['SN (Serial Number) column is required but not found.'],
      headerRowIndex
    };
  }
  
  // Parse data rows
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    const sn = columnMap.sn !== -1 ? String(row[columnMap.sn] || '').trim() : '';
    
    if (!sn) {
      continue; // Skip rows without SN
    }
    
    // Skip if this looks like another header row
    if (isHeaderRow(row.map(cell => String(cell || '')))) {
      continue;
    }
    
    const item: InventoryImportItem = {
      sn,
      kodeItem: columnMap.kodeItem !== -1 ? String(row[columnMap.kodeItem] || '').trim() || null : null,
      sc: columnMap.sc !== -1 ? String(row[columnMap.sc] || '').trim() || null : null,
      namaBarang: columnMap.namaBarang !== -1 ? String(row[columnMap.namaBarang] || '').trim() || null : null,
      qty: 1
    };
    
    // Parse qty
    if (columnMap.qty !== -1) {
      const qtyStr = String(row[columnMap.qty] || '').trim();
      const qtyNum = parseInt(qtyStr);
      if (!isNaN(qtyNum) && qtyNum > 0) {
        item.qty = qtyNum;
      }
    }
    
    items.push(item);
  }
  
  console.log(`✅ Parsed ${items.length} inventory items`);
  
  return {
    success: true,
    items,
    errors,
    headerRowIndex
  };
}

export default { parseInventoryFile };
