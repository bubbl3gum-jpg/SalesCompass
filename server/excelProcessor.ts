import * as XLSX from 'xlsx';
import { transferImportStorage } from './objectStorage';

export interface ExcelImportResult {
  importedCount: number;
  errors: string[];
  data: any[];
}

export class ExcelProcessor {
  // Process Excel/ODS file from buffer and extract opening stock data
  static async processExcelFileFromBuffer(fileBuffer: Buffer): Promise<any[]> {
    try {
      
      // Parse the Excel/ODS file
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      
      // Get the first worksheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length === 0) {
        throw new Error('Empty Excel file');
      }
      
      // Get headers from first row
      const headers = (jsonData[0] as any[]).map((h: any) => 
        String(h || '').trim().toLowerCase()
      );
      
      // Map common header variations to standard names
      const headerMap: { [key: string]: string } = {
        'sn': 'sn',
        's/n': 'sn',
        'serial_number': 'sn',
        'serial number': 'sn',
        'serial': 'sn',
        'kode_item': 'kodeItem',
        'kode item': 'kodeItem',
        'item_code': 'kodeItem',
        'item code': 'kodeItem',
        'itemcode': 'kodeItem',
        'code': 'kodeItem',
        'kode': 'kodeItem',
        'nama_item': 'namaItem',
        'nama item': 'namaItem',
        'item_name': 'namaItem',
        'item name': 'namaItem',
        'itemname': 'namaItem',
        'name': 'namaItem',
        'nama': 'namaItem',
        'qty': 'qty',
        'quantity': 'qty',
        'jumlah': 'qty',
        'stok': 'qty',
        'stock': 'qty'
      };
      
      // Process data rows (skip header)
      const processedData = (jsonData.slice(1) as any[][])
        .map((row: any[], index: number) => {
          const item: any = {};
          
          headers.forEach((header, colIndex) => {
            const mappedHeader = headerMap[header] || header;
            const cellValue = row[colIndex];
            
            if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
              if (mappedHeader === 'qty') {
                // Handle numeric values for quantity
                const numValue = typeof cellValue === 'number' ? cellValue : parseFloat(String(cellValue));
                item[mappedHeader] = isNaN(numValue) ? 0 : Math.floor(numValue);
              } else {
                item[mappedHeader] = String(cellValue).trim();
              }
            }
          });
          
          // Only include rows with kodeItem
          return item.kodeItem ? item : null;
        })
        .filter(item => item !== null);
      
      return processedData;
      
    } catch (error) {
      console.error('Error processing Excel file:', error);
      throw new Error(`Failed to process Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Process Excel/ODS file and extract opening stock data (legacy method for URL-based imports)
  static async processExcelFile(fileUrl: string): Promise<any[]> {
    try {
      // Download file content
      const fileBuffer = await transferImportStorage.getFileContent(fileUrl);
      return await this.processExcelFileFromBuffer(fileBuffer);
    } catch (error) {
      console.error('Error processing Excel file:', error);
      throw new Error(`Failed to process Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Import opening stock data from processed Excel data using file buffer
  static async importOpeningStockFromBuffer(
    fileBuffer: Buffer, 
    mode: 'amend' | 'replace',
    storage: any
  ): Promise<ExcelImportResult> {
    try {
      // Process Excel file to extract data
      const extractedData = await this.processExcelFileFromBuffer(fileBuffer);
      
      if (extractedData.length === 0) {
        return {
          importedCount: 0,
          errors: ['No valid data found in Excel file'],
          data: []
        };
      }
      
      const errors: string[] = [];
      let importedCount = 0;
      
      // If replace mode, clear existing opening stock first
      if (mode === 'replace') {
        await storage.clearOpeningStock();
      }
      
      // Import each item
      for (const item of extractedData) {
        try {
          // Validate required fields
          if (!item.kodeItem) {
            errors.push(`Row ${importedCount + 1}: Missing kodeItem`);
            continue;
          }
          
          if (!item.qty || item.qty < 0) {
            errors.push(`Row ${importedCount + 1}: Invalid quantity for ${item.kodeItem}`);
            continue;
          }
          
          // Create opening stock entry
          await storage.createOpeningStock({
            sn: item.sn || null,
            kodeItem: item.kodeItem,
            namaItem: item.namaItem || item.kodeItem,
            qty: item.qty || 0
          });
          
          importedCount++;
          
        } catch (error) {
          errors.push(`Row ${importedCount + 1}: ${error instanceof Error ? error.message : 'Import failed'}`);
        }
      }
      
      return {
        importedCount,
        errors,
        data: extractedData
      };
      
    } catch (error) {
      console.error('Error importing from Excel:', error);
      throw new Error(`Failed to import from Excel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Import opening stock data from processed Excel data (legacy method for URL-based imports)
  static async importOpeningStockFromExcel(
    fileUrl: string, 
    mode: 'amend' | 'replace',
    storage: any
  ): Promise<ExcelImportResult> {
    try {
      // Process Excel file to extract data
      const extractedData = await this.processExcelFile(fileUrl);
      
      if (extractedData.length === 0) {
        return {
          importedCount: 0,
          errors: ['No valid data found in Excel file'],
          data: []
        };
      }
      
      const errors: string[] = [];
      let importedCount = 0;
      
      // If replace mode, clear existing opening stock first
      if (mode === 'replace') {
        await storage.clearOpeningStock();
      }
      
      // Import each item
      for (const item of extractedData) {
        try {
          // Validate required fields
          if (!item.kodeItem) {
            errors.push(`Row ${importedCount + 1}: Missing kodeItem`);
            continue;
          }
          
          if (!item.qty || item.qty < 0) {
            errors.push(`Row ${importedCount + 1}: Invalid quantity for ${item.kodeItem}`);
            continue;
          }
          
          // Create opening stock entry
          await storage.createOpeningStock({
            sn: item.sn || null,
            kodeItem: item.kodeItem,
            namaItem: item.namaItem || item.kodeItem,
            qty: item.qty || 0
          });
          
          importedCount++;
          
        } catch (error) {
          errors.push(`Row ${importedCount + 1}: ${error instanceof Error ? error.message : 'Import failed'}`);
        }
      }
      
      return {
        importedCount,
        errors,
        data: extractedData
      };
      
    } catch (error) {
      console.error('Error importing from Excel:', error);
      throw new Error(`Failed to import from Excel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}