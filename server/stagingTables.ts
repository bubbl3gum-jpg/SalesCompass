// Staging table schemas for high-performance bulk loading
import { db } from './db';

// Staging table DDL - minimal indexes for fast bulk loading
export const createStagingTables = async () => {
  try {
    // Drop existing staging tables to avoid conflicts
    await db.execute('DROP TABLE IF EXISTS staging_reference_sheet CASCADE');
    await db.execute('DROP TABLE IF EXISTS staging_staff CASCADE');
    await db.execute('DROP TABLE IF EXISTS staging_stores CASCADE');
    await db.execute('DROP TABLE IF EXISTS staging_pricelist CASCADE');
    
    // Staging table for reference sheet imports
    await db.execute(`
      CREATE TABLE IF NOT EXISTS staging_reference_sheet (
        id SERIAL PRIMARY KEY,
        job_id VARCHAR(255) NOT NULL,
        row_number INT NOT NULL,
        kode_item VARCHAR(255),
        nama_item TEXT,
        kelompok VARCHAR(255),
        family VARCHAR(255),
        original_code VARCHAR(255),
        color VARCHAR(255),
        kode_material VARCHAR(255),
        deskripsi_material TEXT,
        kode_motif VARCHAR(255),
        deskripsi_motif TEXT,
        import_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_staging_ref_job_id ON staging_reference_sheet (job_id)`);

    // Staging table for staff imports
    await db.execute(`
      CREATE TABLE IF NOT EXISTS staging_staff (
        id SERIAL PRIMARY KEY,
        job_id VARCHAR(255) NOT NULL,
        row_number INT NOT NULL,
        nik VARCHAR(255),
        email VARCHAR(255),
        nama VARCHAR(255),
        no_telepon VARCHAR(255),
        position_id INT,
        store_access TEXT,
        kode_gudang VARCHAR(255),
        import_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_staging_staff_job_id ON staging_staff (job_id)`);

    // Staging table for stores imports
    await db.execute(`
      CREATE TABLE IF NOT EXISTS staging_stores (
        id SERIAL PRIMARY KEY,
        job_id VARCHAR(255) NOT NULL,
        row_number INT NOT NULL,
        kode_gudang VARCHAR(255),
        nama_gudang VARCHAR(255),
        jenis_gudang VARCHAR(255),
        store_username VARCHAR(255),
        store_password VARCHAR(255),
        import_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_staging_stores_job_id ON staging_stores (job_id)`);

    // Staging table for pricelist imports
    await db.execute(`
      CREATE TABLE IF NOT EXISTS staging_pricelist (
        id SERIAL PRIMARY KEY,
        job_id VARCHAR(255) NOT NULL,
        row_number INT NOT NULL,
        kode_item VARCHAR(255),
        kode_gudang VARCHAR(255),
        harga_beli DECIMAL(15,2),
        harga_jual DECIMAL(15,2),
        import_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_staging_pricelist_job_id ON staging_pricelist (job_id)`);

    // Staging table for transfer items
    await db.execute(`
      CREATE TABLE IF NOT EXISTS staging_transfer_items (
        job_id VARCHAR(255) NOT NULL,
        row_number INT NOT NULL,
        to_id INT,
        sn VARCHAR(100),
        kode_item VARCHAR(50),
        nama_item VARCHAR(255),
        qty INT DEFAULT 1,
        to_number VARCHAR(100),
        import_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_staging_transfer_items_job_id ON staging_transfer_items (job_id)`);

    // Staging table for stock opname items
    await db.execute(`
      CREATE TABLE IF NOT EXISTS staging_stock_opname_items (
        job_id VARCHAR(255) NOT NULL,
        row_number INT NOT NULL,
        so_id INT,
        sn VARCHAR(100),
        kode_item VARCHAR(50),
        nama_item VARCHAR(255),
        qty_system INT DEFAULT 0,
        qty_actual INT DEFAULT 0,
        import_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_staging_stock_opname_items_job_id ON staging_stock_opname_items (job_id)`);

    console.log('Staging tables created successfully');
  } catch (error) {
    console.error('Error creating staging tables:', error);
    throw error;
  }
};

// Clean up staging data for a specific job
export const cleanupStagingData = async (jobId: string) => {
  try {
    await Promise.all([
      db.execute('DELETE FROM staging_reference_sheet WHERE job_id = ?', [jobId]),
      db.execute('DELETE FROM staging_staff WHERE job_id = ?', [jobId]),
      db.execute('DELETE FROM staging_stores WHERE job_id = ?', [jobId]),
      db.execute('DELETE FROM staging_pricelist WHERE job_id = ?', [jobId]),
      db.execute('DELETE FROM staging_transfer_items WHERE job_id = ?', [jobId]),
      db.execute('DELETE FROM staging_stock_opname_items WHERE job_id = ?', [jobId])
    ]);
  } catch (error) {
    console.error('Error cleaning up staging data:', error);
  }
};

// Get staging table name for a table type
export const getStagingTableName = (tableName: string): string => {
  const mappings: Record<string, string> = {
    'reference-sheet': 'staging_reference_sheet',
    'staff': 'staging_staff',
    'stores': 'staging_stores',
    'pricelist': 'staging_pricelist',
    'transfer-items': 'staging_transfer_items',
    'stock-opname-items': 'staging_stock_opname_items'
  };
  
  return mappings[tableName] || `staging_${tableName}`;
};

// Get column mappings for staging tables
export const getStagingColumns = (tableName: string): string[] => {
  const mappings: Record<string, string[]> = {
    'reference-sheet': [
      'job_id', 'row_number', 'kode_item', 'nama_item', 'kelompok', 'family',
      'original_code', 'color', 'kode_material', 'deskripsi_material',
      'kode_motif', 'deskripsi_motif'
    ],
    'staff': [
      'job_id', 'row_number', 'nik', 'email', 'nama', 'no_telepon',
      'position_id', 'store_access', 'kode_gudang'
    ],
    'stores': [
      'job_id', 'row_number', 'kode_gudang', 'nama_gudang', 'jenis_gudang',
      'store_username', 'store_password'
    ],
    'pricelist': [
      'job_id', 'row_number', 'kode_item', 'kode_gudang', 'harga_beli', 'harga_jual'
    ],
    'transfer-items': [
      'job_id', 'row_number', 'to_id', 'sn', 'kode_item', 'nama_item', 'qty', 'to_number'
    ],
    'stock-opname-items': [
      'job_id', 'row_number', 'so_id', 'sn', 'kode_item', 'nama_item', 'qty_system', 'qty_actual'
    ]
  };
  
  return mappings[tableName] || [];
};