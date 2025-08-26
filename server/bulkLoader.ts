// High-performance bulk loader with MySQL LOAD DATA INFILE support
import { db } from './db';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { getStagingTableName, getStagingColumns } from './stagingTables';
import { ParsedRow } from './streamingParser';

export interface BulkLoadResult {
  loaded: number;
  errors: number;
  throughputRps: number;
  duration: number;
}

export class BulkLoader {
  private tempDir = tmpdir();

  // High-performance bulk load using MySQL LOAD DATA INFILE
  async bulkLoadToStaging(
    jobId: string,
    tableName: string,
    rows: ParsedRow[],
    onProgress?: (loaded: number, total: number) => void
  ): Promise<BulkLoadResult> {
    const startTime = Date.now();
    const stagingTable = getStagingTableName(tableName);
    const columns = getStagingColumns(tableName);
    
    if (rows.length === 0) {
      return { loaded: 0, errors: 0, throughputRps: 0, duration: 0 };
    }

    try {
      // Prepare CSV file for LOAD DATA INFILE
      const tempFile = await this.createTempCSVFile(jobId, tableName, rows);
      
      // Build LOAD DATA INFILE query
      const loadQuery = `
        LOAD DATA LOCAL INFILE ?
        INTO TABLE ${stagingTable}
        FIELDS TERMINATED BY ','
        FIELDS OPTIONALLY ENCLOSED BY '"'
        LINES TERMINATED BY '\\n'
        IGNORE 1 LINES
        (${columns.join(', ')})
      `;

      // Enable local_infile for this connection
      await db.execute('SET SESSION local_infile = 1');
      
      // Execute bulk load
      const result = await db.execute(loadQuery, [tempFile]);
      const affectedRows = (result as any)[0]?.affectedRows || 0;
      
      // Clean up temp file
      unlinkSync(tempFile);
      
      const duration = Date.now() - startTime;
      const throughputRps = affectedRows / (duration / 1000);
      
      onProgress?.(affectedRows, rows.length);
      
      return {
        loaded: affectedRows,
        errors: rows.length - affectedRows,
        throughputRps,
        duration
      };
      
    } catch (error) {
      console.error('Bulk load error:', error);
      
      // Fallback to batched inserts if LOAD DATA INFILE fails
      return await this.batchedInsert(jobId, tableName, rows, onProgress);
    }
  }

  // Fallback: Batched inserts with prepared statements
  private async batchedInsert(
    jobId: string,
    tableName: string,
    rows: ParsedRow[],
    onProgress?: (loaded: number, total: number) => void
  ): Promise<BulkLoadResult> {
    const startTime = Date.now();
    const stagingTable = getStagingTableName(tableName);
    const columns = getStagingColumns(tableName);
    const batchSize = 1000; // Optimal batch size for performance
    
    let loaded = 0;
    let errors = 0;

    try {
      // Build insert query with multiple value placeholders
      const valuePlaceholders = columns.map(() => '?').join(', ');
      const insertQuery = `
        INSERT INTO ${stagingTable} (${columns.join(', ')})
        VALUES ${Array(batchSize).fill(`(${valuePlaceholders})`).join(', ')}
      `;

      // Process in batches
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const batchValues: any[] = [];
        
        batch.forEach(row => {
          const values = this.mapRowToStagingColumns(row, jobId, tableName);
          batchValues.push(...values);
        });

        try {
          // Use appropriate query size for this batch
          const actualBatchSize = batch.length;
          let batchQuery = insertQuery;
          
          if (actualBatchSize < batchSize) {
            const actualValuePlaceholders = columns.map(() => '?').join(', ');
            batchQuery = `
              INSERT INTO ${stagingTable} (${columns.join(', ')})
              VALUES ${Array(actualBatchSize).fill(`(${actualValuePlaceholders})`).join(', ')}
            `;
          }

          await db.execute(batchQuery, batchValues);
          loaded += batch.length;
          
        } catch (batchError) {
          console.error(`Batch insert error for rows ${i}-${i + batch.length}:`, batchError);
          errors += batch.length;
        }

        onProgress?.(loaded, rows.length);
      }

    } catch (error) {
      console.error('Batched insert error:', error);
      errors = rows.length;
    }

    const duration = Date.now() - startTime;
    const throughputRps = loaded / (duration / 1000);

    return {
      loaded,
      errors,
      throughputRps,
      duration
    };
  }

  // Create temporary CSV file for LOAD DATA INFILE
  private async createTempCSVFile(
    jobId: string,
    tableName: string,
    rows: ParsedRow[]
  ): Promise<string> {
    const tempFile = join(this.tempDir, `import_${jobId}_${randomUUID()}.csv`);
    const columns = getStagingColumns(tableName);
    
    // Create CSV content
    let csvContent = columns.join(',') + '\n';
    
    rows.forEach(row => {
      const values = this.mapRowToStagingColumns(row, jobId, tableName);
      const csvRow = values.map(val => 
        val === null || val === undefined ? '' : `"${String(val).replace(/"/g, '""')}"`
      ).join(',');
      csvContent += csvRow + '\n';
    });

    // Write to temp file
    writeFileSync(tempFile, csvContent, 'utf8');
    return tempFile;
  }

  // Map parsed row to staging table columns
  private mapRowToStagingColumns(row: ParsedRow, jobId: string, tableName: string): any[] {
    const columns = getStagingColumns(tableName);
    const values: any[] = [];

    columns.forEach(column => {
      if (column === 'job_id') {
        values.push(jobId);
      } else if (column === 'row_number') {
        values.push(row.rowNumber);
      } else {
        // Map from parsed data using column name without underscores
        const dataKey = column.replace(/_/g, '');
        const camelCaseKey = this.toCamelCase(column);
        values.push(row.data[dataKey] || row.data[camelCaseKey] || null);
      }
    });

    return values;
  }

  // Convert snake_case to camelCase
  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  }

  // Validate staging data before finalization
  async validateStagingData(jobId: string, tableName: string): Promise<{
    valid: number;
    invalid: number;
    errors: Array<{ rowNumber: number; error: string }>;
  }> {
    const stagingTable = getStagingTableName(tableName);
    
    try {
      // Get total count
      const totalResult = await db.execute(
        `SELECT COUNT(*) as total FROM ${stagingTable} WHERE job_id = ?`,
        [jobId]
      );
      const total = (totalResult as any[])[0][0]?.total || 0;

      // Validate based on table type
      const validationRules = this.getValidationRules(tableName);
      const errors: Array<{ rowNumber: number; error: string }> = [];

      for (const rule of validationRules) {
        const [invalidRows] = await db.execute(
          `SELECT row_number FROM ${stagingTable} WHERE job_id = ? AND ${rule.condition}`,
          [jobId]
        );

        (invalidRows as any[]).forEach(row => {
          errors.push({
            rowNumber: row.row_number,
            error: rule.message
          });
        });
      }

      const invalid = errors.length;
      const valid = total - invalid;

      return { valid, invalid, errors };

    } catch (error) {
      console.error('Validation error:', error);
      return { valid: 0, invalid: 0, errors: [] };
    }
  }

  // Get validation rules for different table types
  private getValidationRules(tableName: string): Array<{ condition: string; message: string }> {
    const rules: Record<string, Array<{ condition: string; message: string }>> = {
      'reference-sheet': [
        { condition: 'kode_item IS NULL OR kode_item = ""', message: 'Item code is required' },
        { condition: 'nama_item IS NULL OR nama_item = ""', message: 'Item name is required' }
      ],
      'staff': [
        { condition: 'nik IS NULL OR nik = ""', message: 'NIK is required' },
        { condition: 'email IS NULL OR email = "" OR email NOT LIKE "%@%"', message: 'Valid email is required' }
      ],
      'stores': [
        { condition: 'kode_gudang IS NULL OR kode_gudang = ""', message: 'Store code is required' },
        { condition: 'nama_gudang IS NULL OR nama_gudang = ""', message: 'Store name is required' }
      ],
      'pricelist': [
        { condition: 'kode_item IS NULL OR kode_item = ""', message: 'Item code is required' },
        { condition: 'kode_gudang IS NULL OR kode_gudang = ""', message: 'Store code is required' },
        { condition: 'harga_jual IS NULL OR harga_jual <= 0', message: 'Valid selling price is required' }
      ],
      'transfer-items': [
        { condition: 'to_id IS NULL', message: 'Transfer Order ID is required' },
        { condition: 'kode_item IS NULL OR kode_item = ""', message: 'Item code is required' },
        { condition: 'qty IS NULL OR qty <= 0', message: 'Valid quantity is required' }
      ],
      'stock-opname-items': [
        { condition: 'so_id IS NULL', message: 'Stock Opname ID is required' },
        { condition: 'kode_item IS NULL OR kode_item = ""', message: 'Item code is required' }
      ]
    };

    return rules[tableName] || [];
  }

  // Atomic upsert from staging to target tables
  async atomicUpsert(jobId: string, tableName: string): Promise<{
    inserted: number;
    updated: number;
    errors: number;
  }> {
    const stagingTable = getStagingTableName(tableName);
    
    try {
      // Start transaction for atomic operation
      await db.execute('START TRANSACTION');

      let result = { inserted: 0, updated: 0, errors: 0 };

      switch (tableName) {
        case 'reference-sheet':
          result = await this.upsertReferenceSheet(jobId, stagingTable);
          break;
        case 'staff':
          result = await this.upsertStaff(jobId, stagingTable);
          break;
        case 'stores':
          result = await this.upsertStores(jobId, stagingTable);
          break;
        case 'pricelist':
          result = await this.upsertPricelist(jobId, stagingTable);
          break;
        case 'transfer-items':
          result = await this.upsertTransferItems(jobId, stagingTable);
          break;
        case 'stock-opname-items':
          result = await this.upsertStockOpnameItems(jobId, stagingTable);
          break;
        default:
          throw new Error(`Unsupported table type: ${tableName}`);
      }

      // Commit transaction
      await db.execute('COMMIT');
      return result;

    } catch (error) {
      // Rollback on error
      await db.execute('ROLLBACK');
      console.error('Atomic upsert error:', error);
      throw error;
    }
  }

  // Upsert methods for specific tables
  private async upsertReferenceSheet(jobId: string, stagingTable: string): Promise<{
    inserted: number;
    updated: number;
    errors: number;
  }> {
    const upsertQuery = `
      INSERT INTO reference_sheet (kodeItem, namaItem, kelompok, family, originalCode, color, kodeMaterial, deskripsiMaterial, kodeMotif, deskripsiMotif)
      SELECT kode_item, nama_item, kelompok, family, original_code, color, kode_material, deskripsi_material, kode_motif, deskripsi_motif
      FROM ${stagingTable}
      WHERE job_id = ? AND kode_item IS NOT NULL AND nama_item IS NOT NULL
      ON DUPLICATE KEY UPDATE
        namaItem = VALUES(namaItem),
        kelompok = VALUES(kelompok),
        family = VALUES(family),
        originalCode = VALUES(originalCode),
        color = VALUES(color),
        kodeMaterial = VALUES(kodeMaterial),
        deskripsiMaterial = VALUES(deskripsiMaterial),
        kodeMotif = VALUES(kodeMotif),
        deskripsiMotif = VALUES(deskripsiMotif)
    `;

    const [result] = await db.execute(upsertQuery, [jobId]);
    const affectedRows = (result as any).affectedRows || 0;
    const changedRows = (result as any).changedRows || 0;

    return {
      inserted: affectedRows - changedRows,
      updated: changedRows,
      errors: 0
    };
  }

  private async upsertStaff(jobId: string, stagingTable: string): Promise<{
    inserted: number;
    updated: number;
    errors: number;
  }> {
    const upsertQuery = `
      INSERT INTO staff (nik, email, nama, noTelepon, positionId, storeAccess, kodeGudang)
      SELECT nik, email, nama, no_telepon, position_id, store_access, kode_gudang
      FROM ${stagingTable}
      WHERE job_id = ? AND nik IS NOT NULL AND email IS NOT NULL
      ON DUPLICATE KEY UPDATE
        email = VALUES(email),
        nama = VALUES(nama),
        noTelepon = VALUES(noTelepon),
        positionId = VALUES(positionId),
        storeAccess = VALUES(storeAccess),
        kodeGudang = VALUES(kodeGudang)
    `;

    const [result] = await db.execute(upsertQuery, [jobId]);
    const affectedRows = (result as any).affectedRows || 0;
    const changedRows = (result as any).changedRows || 0;

    return {
      inserted: affectedRows - changedRows,
      updated: changedRows,
      errors: 0
    };
  }

  private async upsertStores(jobId: string, stagingTable: string): Promise<{
    inserted: number;
    updated: number;
    errors: number;
  }> {
    const upsertQuery = `
      INSERT INTO stores (kodeGudang, namaGudang, jenisGudang, storeUsername, storePassword)
      SELECT kode_gudang, nama_gudang, jenis_gudang, store_username, store_password
      FROM ${stagingTable}
      WHERE job_id = ? AND kode_gudang IS NOT NULL AND nama_gudang IS NOT NULL
      ON DUPLICATE KEY UPDATE
        namaGudang = VALUES(namaGudang),
        jenisGudang = VALUES(jenisGudang),
        storeUsername = VALUES(storeUsername),
        storePassword = VALUES(storePassword)
    `;

    const [result] = await db.execute(upsertQuery, [jobId]);
    const affectedRows = (result as any).affectedRows || 0;
    const changedRows = (result as any).changedRows || 0;

    return {
      inserted: affectedRows - changedRows,
      updated: changedRows,
      errors: 0
    };
  }

  private async upsertPricelist(jobId: string, stagingTable: string): Promise<{
    inserted: number;
    updated: number;
    errors: number;
  }> {
    const upsertQuery = `
      INSERT INTO pricelist (kodeItem, kodeGudang, hargaBeli, hargaJual)
      SELECT kode_item, kode_gudang, harga_beli, harga_jual
      FROM ${stagingTable}
      WHERE job_id = ? AND kode_item IS NOT NULL AND kode_gudang IS NOT NULL AND harga_jual > 0
      ON DUPLICATE KEY UPDATE
        hargaBeli = VALUES(hargaBeli),
        hargaJual = VALUES(hargaJual)
    `;

    const [result] = await db.execute(upsertQuery, [jobId]);
    const affectedRows = (result as any).affectedRows || 0;
    const changedRows = (result as any).changedRows || 0;

    return {
      inserted: affectedRows - changedRows,
      updated: changedRows,
      errors: 0
    };
  }

  private async upsertTransferItems(jobId: string, stagingTable: string): Promise<{
    inserted: number;
    updated: number;
    errors: number;
  }> {
    // First, update transfer order with TO number if available
    const toUpdateQuery = `
      UPDATE transfer_order 
      SET toNumber = (
        SELECT DISTINCT to_number 
        FROM ${stagingTable} 
        WHERE job_id = ? AND to_id = transfer_order.toId AND to_number IS NOT NULL 
        LIMIT 1
      )
      WHERE toId IN (
        SELECT DISTINCT to_id 
        FROM ${stagingTable} 
        WHERE job_id = ? AND to_id IS NOT NULL
      )
    `;
    
    await db.execute(toUpdateQuery, [jobId, jobId]);

    // Then insert/update transfer items
    const upsertQuery = `
      INSERT INTO to_itemlist (toId, sn, kodeItem, namaItem, qty)
      SELECT to_id, sn, kode_item, nama_item, COALESCE(qty, 1)
      FROM ${stagingTable}
      WHERE job_id = ? AND to_id IS NOT NULL AND kode_item IS NOT NULL
      ON DUPLICATE KEY UPDATE
        namaItem = VALUES(namaItem),
        qty = VALUES(qty)
    `;

    const [result] = await db.execute(upsertQuery, [jobId]);
    const affectedRows = (result as any).affectedRows || 0;
    const changedRows = (result as any).changedRows || 0;

    return {
      inserted: affectedRows - changedRows,
      updated: changedRows,
      errors: 0
    };
  }

  private async upsertStockOpnameItems(jobId: string, stagingTable: string): Promise<{
    inserted: number;
    updated: number;
    errors: number;
  }> {
    const upsertQuery = `
      INSERT INTO so_itemlist (soId, sn, kodeItem, namaItem, qtySystem, qtyActual)
      SELECT so_id, sn, kode_item, nama_item, COALESCE(qty_system, 0), COALESCE(qty_actual, 0)
      FROM ${stagingTable}
      WHERE job_id = ? AND so_id IS NOT NULL AND kode_item IS NOT NULL
      ON DUPLICATE KEY UPDATE
        namaItem = VALUES(namaItem),
        qtySystem = VALUES(qtySystem),
        qtyActual = VALUES(qtyActual)
    `;

    const [result] = await db.execute(upsertQuery, [jobId]);
    const affectedRows = (result as any).affectedRows || 0;
    const changedRows = (result as any).changedRows || 0;

    return {
      inserted: affectedRows - changedRows,
      updated: changedRows,
      errors: 0
    };
  }
}