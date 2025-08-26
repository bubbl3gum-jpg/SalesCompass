import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { z } from "zod";
import multer from "multer";
import * as XLSX from "xlsx";
import * as csv from "csv-parser";
import { Readable } from "stream";
import { 
  insertLaporanPenjualanSchema, 
  insertSettlementSchema,
  insertTransferOrderSchema,
  insertStockOpnameSchema,
  insertSoItemListSchema,
  insertReferenceSheetSchema,
  insertPricelistSchema,
  insertDiscountTypeSchema,
  insertStoreSchema,
  insertStaffSchema,
  insertPositionSchema,
  insertToItemListSchema,
  type Pricelist 
} from "@shared/schema";

// Price resolution function based on the business rules
function resolvePriceFromPricelist(
  pricelist: Pricelist[], 
  serialNumber?: string,
  kodeItem?: string, 
  kelompok?: string,
  family?: string,
  deskripsiMaterial?: string,
  kodeMotif?: string
): { price: string, source: string } {
  
  // Step 1: Serial number exact match
  if (serialNumber) {
    const snMatch = pricelist.find(p => p.sn === serialNumber);
    if (snMatch) {
      const price = snMatch.sp || snMatch.normalPrice || '0';
      return { price: price.toString(), source: 'serial' };
    }
  }

  // Step 2: Kode item exact match
  if (kodeItem) {
    const kiMatch = pricelist.find(p => p.kodeItem === kodeItem);
    if (kiMatch) {
      const price = kiMatch.sp || kiMatch.normalPrice || '0';
      return { price: price.toString(), source: 'item' };
    }
  }

  // Step 3: Generic match (family + deskripsi_material with empty kelompok and kode_motif)
  let genericPrice = '';
  if (family && deskripsiMaterial) {
    const genericMatch = pricelist.find(p => 
      p.family === family && 
      p.deskripsiMaterial === deskripsiMaterial &&
      (!p.kelompok || p.kelompok === '') &&
      (!p.kodeMotif || p.kodeMotif === '')
    );
    if (genericMatch) {
      genericPrice = (genericMatch.sp || genericMatch.normalPrice || '0').toString();
    }
  }

  // Step 4: Best match with scoring
  let bestPrice = '';
  if (family && deskripsiMaterial) {
    const rowsFE = pricelist.filter(p => p.family === family && p.deskripsiMaterial === deskripsiMaterial);
    
    if (rowsFE.length > 0) {
      let topScore = 0;
      let bestMatch: Pricelist | null = null;

      for (const row of rowsFE) {
        let score = 0;
        if (row.kelompok === kelompok) score += 1;
        if (row.kodeMotif === kodeMotif) score += 1;

        if (score > topScore) {
          topScore = score;
          bestMatch = row;
        }
      }

      if (topScore > 0 && (kelompok || kodeMotif) && bestMatch) {
        bestPrice = (bestMatch.sp || bestMatch.normalPrice || '0').toString();
      }
    }
  }

  // Step 5: Apply precedence
  if (bestPrice) {
    return { price: bestPrice, source: 'best' };
  } else {
    const hasRef = !!(serialNumber || kodeItem || kelompok || kodeMotif);
    if (hasRef && genericPrice) {
      return { price: genericPrice, source: 'generic' };
    }
  }

  return { price: 'TIDAK DITEMUKAN', source: 'not_found' };
}

// Simplified middleware for now - skip role checking until we implement user roles
const checkRole = (allowedRoles: string[]) => {
  return async (req: any, res: any, next: any) => {
    // For now, just check authentication
    if (!req.user?.claims?.email) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    next();
  };
};

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(csv|xlsx?|xlsm)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

// Helper function to parse CSV data for different table types
function parseCSV(buffer: Buffer, tableName?: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    const csvContent = buffer.toString();
    const lines = csvContent.split('\n');
    
    // Staff-specific parsing with proper field mapping
    if (tableName === 'staff') {
      
      // Look for staff data headers
      let headerRowIndex = -1;
      let headers: string[] = [];
      
      for (let i = 0; i < Math.min(5, lines.length); i++) {
        const line = lines[i].trim();
        
        // Look for common staff headers (more flexible)
        if (line.toLowerCase().includes('nik') || 
            line.toLowerCase().includes('email') ||
            line.toLowerCase().includes('full name') ||
            line.toLowerCase().includes('password') ||
            line.toLowerCase().includes('city') ||
            line.toLowerCase().includes('address')) {
          headerRowIndex = i;
          headers = line.split(',').map(h => h.trim().replace(/"/g, ''));
          break;
        }
      }
      
      if (headerRowIndex === -1) {
        // If no header row found, assume first row is headers
        headerRowIndex = 0;
        headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      }
      
      
      // Define mapping from CSV headers to database fields (case-insensitive and flexible)
      const getFieldMapping = (header: string): string | null => {
        const cleanHeader = header.toLowerCase().trim().replace(/[\s_-]+/g, ' ');
        
        const mappings: { [key: string]: string } = {
          'nik': 'nik',
          'email': 'email', 
          'password': 'password',
          'full name': 'namaLengkap',
          'nama lengkap': 'namaLengkap',
          'city': 'kota',
          'kota': 'kota',
          'address': 'alamat',
          'alamat': 'alamat',
          'phone number': 'noHp',
          'phone': 'noHp',
          'no hp': 'noHp',
          'place of birth': 'tempatLahir',
          'tempat lahir': 'tempatLahir',
          'date of birth': 'tanggalLahir',
          'tanggal lahir': 'tanggalLahir',
          'date joined': 'tanggalMasuk',
          'tanggal masuk': 'tanggalMasuk',
          'position': 'jabatan',
          'jabatan': 'jabatan'
        };
        
        return mappings[cleanHeader] || null;
      };
      
      
      // Process data rows
      for (let i = headerRowIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.match(/^,*$/)) {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          if (values[0]) { // Only process rows with data in first column
            const rowData: any = {};
            
            
            headers.forEach((header, index) => {
              const mappedField = getFieldMapping(header);
              const value = values[index];
              
              
              if (mappedField && value && value.trim() !== '') {
                // Special handling for dates
                if (mappedField === 'tanggalLahir' || mappedField === 'tanggalMasuk') {
                  const dateValue = value.trim();
                  // Try to parse different date formats
                  let parsedDate = new Date(dateValue);
                  if (isNaN(parsedDate.getTime())) {
                    // Try DD/MM/YYYY format
                    const parts = dateValue.split('/');
                    if (parts.length === 3) {
                      parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                    }
                  }
                  if (!isNaN(parsedDate.getTime())) {
                    rowData[mappedField] = parsedDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
                  } else {
                    // Invalid date format, skip this field
                  }
                } else {
                  rowData[mappedField] = value.trim();
                }
              }
            });
            
            
            if (Object.keys(rowData).length > 0) {
              results.push(rowData);
            }
          }
        }
      }
      
      resolve(results);
      return;
    }
    
    // Store data parsing (existing logic)
    let headerRowIndex = -1;
    let headers: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.toLowerCase().includes('kode gudang') || 
          line.toLowerCase().includes('kode_gudang') ||
          line.toLowerCase().includes('kodegudang')) {
        headerRowIndex = i;
        // Parse the header row and only take first 3 columns
        headers = line.split(',').slice(0, 3).map(h => h.trim().replace(/"/g, ''));
        break;
      }
    }
    
    if (headerRowIndex === -1) {
      // Fallback to old behavior if no proper header found
      const stream = Readable.from(csvContent);
      stream
        .pipe(csv.default())
        .on('data', (data: any) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
      return;
    }
    
    
    // Process data rows starting after the header
    for (let i = headerRowIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.match(/^,*$/)) { // Skip empty lines
        const values = line.split(',').slice(0, 3).map(v => v.trim().replace(/"/g, ''));
        if (values[0]) { // Only include rows with a value in first column
          const rowData: any = {};
          headers.forEach((header, index) => {
            if (header && values[index]) {
              rowData[header] = values[index];
            }
          });
          results.push(rowData);
        }
      }
    }
    
    resolve(results);
  });
}

// Helper function to parse Excel data
function parseExcel(buffer: Buffer): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  // Find the header row that contains "Kode Gudang" or similar
  let headerRowIndex = -1;
  let headers: string[] = [];
  
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i] as any[];
    const rowStr = row.join(' ').toLowerCase();
    if (rowStr.includes('kode gudang') || rowStr.includes('kode_gudang') || rowStr.includes('kodegudang')) {
      headerRowIndex = i;
      // Only take first 3 columns
      headers = row.slice(0, 3).map((h: any) => String(h || '').trim());
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    // Fallback to old behavior
    return XLSX.utils.sheet_to_json(worksheet);
  }
  
  console.log(`📍 Found Excel headers at row ${headerRowIndex + 1}:`, headers);
  
  // Process data rows
  const results: any[] = [];
  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i] as any[];
    if (row && row[0]) { // Only include rows with data in first column
      const rowData: any = {};
      headers.forEach((header, index) => {
        if (header && row[index] !== undefined && row[index] !== null && row[index] !== '') {
          rowData[header] = String(row[index]).trim();
        }
      });
      if (Object.keys(rowData).length > 0) {
        results.push(rowData);
      }
    }
  }
  
  return results;
}

// Helper function to validate and transform import data
function validateImportData(data: any[], tableName: string, schema: any): { valid: any[], invalid: any[], errors: string[] } {
  const valid: any[] = [];
  const invalid: any[] = [];
  const errors: string[] = [];

  data.forEach((row, index) => {
    try {
      // Clean and normalize column names 
      const cleanedRow: any = {};
      Object.keys(row).forEach(key => {
        const trimmedKey = key.trim().toLowerCase();
        const cleanKey = trimmedKey.replace(/\s+/g, ''); // Remove spaces for fallback
        let mappedKey = cleanKey;
        
        // Map common column name variations (check with spaces first, then without)
        const columnMappings: { [key: string]: { [key: string]: string } } = {
          'reference-sheet': {
            'kodeitem': 'kodeItem',
            'namaitem': 'namaItem',
            'deskripsiitem': 'deskripsiItem',
            'serialnumber': 'serialNumber',
            'deskripsimaterial': 'deskripsiMaterial',
            'kodemotif': 'kodeMotif'
          },
          'pricelist': {
            'kodeitem': 'kodeItem',
            'normalprice': 'normalPrice',
            'deskripsimaterial': 'deskripsiMaterial',
            'kodemotif': 'kodeMotif'
          },
          'discounts': {
            'discountcode': 'discountCode',
            'discounttype': 'discountType',
            'discountvalue': 'discountValue',
            'isactive': 'isActive'
          },
          'stores': {
            'kodegudang': 'kodeGudang',
            'namagudang': 'namaGudang',
            'jenisgudang': 'jenisGudang',
            // Handle space-separated headers
            'kode gudang': 'kodeGudang',
            'nama gudang': 'namaGudang', 
            'jenis gudang': 'jenisGudang'
          },
          'staff': {
            'firstname': 'firstName',
            'lastname': 'lastName'
          },
          'stock-opname': {
            'kodegudang': 'kodeGudang'
          },
          'transfers': {
            'fromgudang': 'fromGudang',
            'togudang': 'toGudang',
            'kodeitem': 'kodeItem'
          }
        };
        
        // Check mappings - first with spaces, then without
        if (columnMappings[tableName]) {
          if (columnMappings[tableName][trimmedKey]) {
            mappedKey = columnMappings[tableName][trimmedKey];
          } else if (columnMappings[tableName][cleanKey]) {
            mappedKey = columnMappings[tableName][cleanKey];
          }
        }
        
        cleanedRow[mappedKey] = row[key];
      });
      
      // Special validation for stores - check for blank store code or name
      if (tableName === 'stores') {
        if (!cleanedRow.kodeGudang || cleanedRow.kodeGudang.toString().trim() === '') {
          invalid.push(row);
          errors.push(`Row ${index + 1}: Store code cannot be blank`);
          return;
        }
        if (!cleanedRow.namaGudang || cleanedRow.namaGudang.toString().trim() === '') {
          invalid.push(row);
          errors.push(`Row ${index + 1}: Store name cannot be blank`);
          return;
        }
      }
      
      // Special validation for reference sheet - check for blank item code or name
      if (tableName === 'reference-sheet') {
        if (!cleanedRow.kodeItem || cleanedRow.kodeItem.toString().trim() === '') {
          invalid.push(row);
          errors.push(`Row ${index + 1}: Item code cannot be blank`);
          return;
        }
        if (!cleanedRow.namaItem || cleanedRow.namaItem.toString().trim() === '') {
          invalid.push(row);
          errors.push(`Row ${index + 1}: Item name cannot be blank`);
          return;
        }
      }
      
      const validated = schema.parse(cleanedRow);
      valid.push(validated);
    } catch (error) {
      invalid.push(row);
      errors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : 'Validation failed'}`);
    }
  });

  return { valid, invalid, errors };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Database ping
  app.get('/api/db-ping', (req, res) => {
    res.json({ status: 'connected', timestamp: new Date().toISOString() });
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User permissions route
  app.get('/api/user/permissions', isAuthenticated, async (req: any, res) => {
    try {
      const userEmail = req.user.claims.email;
      const permissions = await storage.getUserPermissions(userEmail);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  // Store authentication route
  app.post('/api/store/auth', isAuthenticated, async (req, res) => {
    try {
      const { kodeGudang, username, password } = req.body;
      
      if (!kodeGudang || !username || !password) {
        return res.status(400).json({ message: "Store code, username and password are required" });
      }

      const store = await storage.getStoreByKode(kodeGudang);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }

      if (store.storeUsername !== username || store.storePassword !== password) {
        return res.status(401).json({ message: "Invalid store credentials" });
      }

      // Store the authenticated store and login type in session
      (req.session as any).authenticatedStore = kodeGudang;
      (req.session as any).storeLoginType = kodeGudang === 'ALL_STORE' ? 'all_store' : 'single_store';
      
      res.json({ 
        message: "Store authentication successful", 
        store: {
          kodeGudang: store.kodeGudang,
          namaGudang: store.namaGudang,
          jenisGudang: store.jenisGudang
        },
        loginType: kodeGudang === 'ALL_STORE' ? 'all_store' : 'single_store'
      });
    } catch (error) {
      console.error("Error authenticating store:", error);
      res.status(500).json({ message: "Failed to authenticate store" });
    }
  });

  // Get current authenticated store
  app.get('/api/store/current', isAuthenticated, async (req, res) => {
    try {
      const authenticatedStore = (req.session as any).authenticatedStore;
      const storeLoginType = (req.session as any).storeLoginType || 'single_store';
      
      if (!authenticatedStore) {
        return res.json({ store: null, loginType: null, canSwitchStores: false });
      }

      const store = await storage.getStoreByKode(authenticatedStore);
      if (!store) {
        // Clear invalid store from session
        delete (req.session as any).authenticatedStore;
        delete (req.session as any).storeLoginType;
        return res.json({ store: null, loginType: null, canSwitchStores: false });
      }

      res.json({ 
        store: {
          kodeGudang: store.kodeGudang,
          namaGudang: store.namaGudang,
          jenisGudang: store.jenisGudang
        },
        loginType: storeLoginType,
        canSwitchStores: storeLoginType === 'all_store'
      });
    } catch (error) {
      console.error("Error fetching current store:", error);
      res.status(500).json({ message: "Failed to fetch current store" });
    }
  });

  // Store switch route (for All Store users only)
  app.post('/api/store/switch', isAuthenticated, async (req, res) => {
    try {
      const { kodeGudang } = req.body;
      const storeLoginType = (req.session as any).storeLoginType;
      
      // Only allow store switching for all_store users
      if (storeLoginType !== 'all_store') {
        return res.status(403).json({ message: "Store switching not allowed for single store users" });
      }
      
      if (!kodeGudang) {
        return res.status(400).json({ message: "Store code is required" });
      }

      const store = await storage.getStoreByKode(kodeGudang);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }

      // Update the current store in session
      (req.session as any).authenticatedStore = kodeGudang;
      
      res.json({ 
        message: "Store switched successfully", 
        store: {
          kodeGudang: store.kodeGudang,
          namaGudang: store.namaGudang,
          jenisGudang: store.jenisGudang
        }
      });
    } catch (error) {
      console.error("Error switching store:", error);
      res.status(500).json({ message: "Failed to switch store" });
    }
  });

  // Store logout route
  app.post('/api/store/logout', isAuthenticated, async (req, res) => {
    try {
      delete (req.session as any).authenticatedStore;
      delete (req.session as any).storeLoginType;
      res.json({ message: "Store logout successful" });
    } catch (error) {
      console.error("Error logging out from store:", error);
      res.status(500).json({ message: "Failed to logout from store" });
    }
  });

  // Staff authentication route
  app.post('/api/staff/auth', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const staff = await storage.getStaffByEmail(email);
      if (!staff || staff.password !== password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Store the authenticated staff in session
      (req.session as any).authenticatedStaff = {
        employeeId: staff.employeeId,
        email: staff.email,
        namaLengkap: staff.namaLengkap,
        jabatan: staff.jabatan
      };

      res.json({ 
        message: "Staff authentication successful", 
        staff: {
          employeeId: staff.employeeId,
          email: staff.email,
          namaLengkap: staff.namaLengkap,
          jabatan: staff.jabatan
        }
      });
    } catch (error) {
      console.error("Error authenticating staff:", error);
      res.status(500).json({ message: "Failed to authenticate staff" });
    }
  });

  // Get current authenticated staff
  app.get('/api/staff/current', async (req, res) => {
    try {
      const authenticatedStaff = (req.session as any).authenticatedStaff;
      res.json({ staff: authenticatedStaff || null });
    } catch (error) {
      console.error("Error fetching current staff:", error);
      res.status(500).json({ message: "Failed to fetch current staff" });
    }
  });

  // Staff logout route
  app.post('/api/staff/logout', async (req, res) => {
    try {
      delete (req.session as any).authenticatedStaff;
      res.json({ message: "Staff logout successful" });
    } catch (error) {
      console.error("Error logging out staff:", error);
      res.status(500).json({ message: "Failed to logout staff" });
    }
  });

  // Store dashboard with aggregated data from all stores
  app.get('/api/stores/dashboard', isAuthenticated, async (req, res) => {
    try {
      const stores = await storage.getStores();
      const dashboardData = [];

      for (const store of stores) {
        // Get metrics for each store
        const metrics = await storage.getDashboardMetrics(store.kodeGudang);
        const recentSales = await storage.getRecentSales(store.kodeGudang, 5); // Get last 5 sales

        dashboardData.push({
          store: {
            kodeGudang: store.kodeGudang,
            namaGudang: store.namaGudang,
            jenisGudang: store.jenisGudang
          },
          metrics: metrics || {
            totalSales: '0',
            totalItems: 0,
            totalRevenue: '0',
            averageOrderValue: '0'
          },
          recentSales: recentSales || []
        });
      }

      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching stores dashboard:", error);
      res.status(500).json({ message: "Failed to fetch stores dashboard" });
    }
  });

  // Price resolution endpoint
  app.get('/api/price/quote', isAuthenticated, async (req, res) => {
    try {
      const {
        serial_number,
        kode_item,
        kelompok,
        family,
        deskripsi_material,
        kode_motif,
        discount_id,
        disc_by_amount
      } = req.query;

      // Get all pricelist items for resolution
      const pricelistItems = await storage.getPricelist();

      // Resolve base price
      const { price, source } = resolvePriceFromPricelist(
        pricelistItems,
        serial_number as string,
        kode_item as string,
        kelompok as string,
        family as string,
        deskripsi_material as string,
        kode_motif as string
      );

      let unitPrice = parseFloat(price === 'TIDAK DITEMUKAN' ? '0' : price);
      let normalPrice = unitPrice;

      // Apply discount
      let discountAmount = 0;
      if (disc_by_amount) {
        discountAmount = parseFloat(disc_by_amount as string);
      } else if (discount_id) {
        // Get discount from database
        const discounts = await storage.getDiscountTypes();
        const discount = discounts.find(d => d.discountId?.toString() === discount_id);
        if (discount) {
          // For now, treat discount_type as percentage if it's a number
          const discountValue = parseFloat(discount.discountType || '0');
          if (!isNaN(discountValue)) {
            discountAmount = (unitPrice * discountValue) / 100;
          }
        }
      }

      const finalPrice = unitPrice - discountAmount;

      res.json({
        normal_price: normalPrice,
        unit_price: unitPrice,
        discount_amount: discountAmount,
        final_price: Math.max(0, finalPrice),
        source
      });

    } catch (error) {
      console.error('Price resolution error:', error);
      res.status(500).json({ message: 'Failed to resolve price' });
    }
  });

  // Opening stock endpoint
  app.get('/api/opening-stock', isAuthenticated, async (req, res) => {
    try {
      const openingStock = await storage.getOpeningStock();
      res.json(openingStock);
    } catch (error) {
      console.error('Opening stock query error:', error);
      res.status(500).json({ message: 'Failed to get opening stock information' });
    }
  });

  // Import endpoint for bulk data upload
  app.post('/api/import', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const { tableName, additionalData } = req.body;
      if (!tableName) {
        return res.status(400).json({ message: 'Table name is required' });
      }

      // Parse additional data if provided
      let parsedAdditionalData = null;
      if (additionalData) {
        try {
          parsedAdditionalData = JSON.parse(additionalData);
        } catch (error) {
          console.error('Failed to parse additional data:', error);
        }
      }

      let parsedData: any[];
      
      // Parse file based on type
      if (req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv')) {
        parsedData = await parseCSV(req.file.buffer, tableName);
      } else {
        parsedData = parseExcel(req.file.buffer);
      }

      if (parsedData.length === 0) {
        return res.status(400).json({ message: 'No data found in file' });
      }

      // Log import analysis

      // Validate data based on table type
      let schema;
      let storageMethod: string;
      
      switch (tableName) {
        case 'reference-sheet':
          schema = insertReferenceSheetSchema;
          storageMethod = 'createReferenceSheet';
          break;
        case 'pricelist':
          schema = insertPricelistSchema;
          storageMethod = 'createPricelist';
          break;
        case 'discounts':
          schema = insertDiscountTypeSchema;
          storageMethod = 'createDiscountType';
          break;
        case 'stores':
          schema = insertStoreSchema;
          storageMethod = 'createStore';
          break;
        case 'staff':
          schema = insertStaffSchema;
          storageMethod = 'createStaff';
          break;
        case 'stock-opname':
          schema = insertStockOpnameSchema;
          storageMethod = 'createStockOpname';
          break;
        case 'stock-opname-items':
          schema = insertSoItemListSchema;
          storageMethod = 'createSoItemList';
          break;
        case 'transfers':
          schema = insertTransferOrderSchema;
          storageMethod = 'createTransferOrder';
          break;
        case 'transfer-items':
          schema = insertToItemListSchema;
          storageMethod = 'createToItemList';
          break;
        default:
          return res.status(400).json({ message: 'Invalid table name' });
      }

      const { valid, invalid, errors } = validateImportData(parsedData, tableName, schema);
      
      // Log validation results  
      console.log(`Validation: ${valid.length} valid, ${invalid.length} invalid records`);
      
      // Insert valid records with special handling for line items
      let successCount = 0;
      const insertErrors: string[] = [];
      const failedRecords: Array<{ record: any; error: string; originalIndex: number }> = [];
      
      for (let i = 0; i < valid.length; i++) {
        const record = valid[i];
        try {
          let finalRecord = { ...record };
          
          // Special handling for Stock Opname items
          if (tableName === 'stock-opname-items') {
            if (parsedAdditionalData?.soId) {
              finalRecord.soId = parsedAdditionalData.soId;
            } else {
              insertErrors.push('SO ID is required for stock opname items');
              failedRecords.push({ record, error: 'SO ID is required for stock opname items', originalIndex: i });
              continue;
            }
            
            // Lookup nama_item from reference sheet if not provided
            if (!finalRecord.namaItem && finalRecord.kodeItem) {
              try {
                const referenceSheets = await storage.getReferenceSheets();
                const referenceItem = referenceSheets.find((item: any) => item.kodeItem === finalRecord.kodeItem);
                if (referenceItem) {
                  finalRecord.namaItem = referenceItem.namaItem;
                }
              } catch (error) {
                console.warn('Failed to lookup nama_item from reference sheet:', error);
              }
            }
          }
          
          // Special handling for Transfer items
          if (tableName === 'transfer-items') {
            if (parsedAdditionalData?.toId) {
              finalRecord.toId = parsedAdditionalData.toId;
            } else {
              const errorMsg = 'Transfer Order ID is required for transfer items';
              insertErrors.push(errorMsg);
              failedRecords.push({ record, error: errorMsg, originalIndex: i });
              continue;
            }
          }
          
          if (typeof (storage as any)[storageMethod] === 'function') {
            await (storage as any)[storageMethod](finalRecord);
            successCount++;
          } else {
            const errorMsg = `Method ${storageMethod} not implemented`;
            insertErrors.push(errorMsg);
            failedRecords.push({ record, error: errorMsg, originalIndex: i });
          }
        } catch (error) {
          const errorMsg = `Failed to insert record: ${error instanceof Error ? error.message : 'Unknown error'}`;
          insertErrors.push(errorMsg);
          failedRecords.push({ record, error: errorMsg, originalIndex: i });
        }
      }
      
      // Add validation failed records to failedRecords array
      invalid.forEach((record, index) => {
        failedRecords.push({ 
          record, 
          error: errors[index] || 'Validation failed', 
          originalIndex: valid.length + index 
        });
      });
      
      res.json({
        success: successCount,
        failed: invalid.length + insertErrors.length,
        errors: [...errors, ...insertErrors].slice(0, 50), // Limit errors to prevent huge responses
        failedRecords: failedRecords.slice(0, 10) // Limit to first 10 failed records for review
      });
      
    } catch (error) {
      console.error('Import error:', error);
      res.status(500).json({ 
        message: 'Import failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Retry single failed import record
  app.post('/api/import/retry', isAuthenticated, async (req, res) => {
    try {
      const { tableName, record } = req.body;
      
      if (!tableName || !record) {
        return res.status(400).json({ message: 'Table name and record data required' });
      }

      // Validate data based on table type
      let schema;
      let storageMethod: string;
      
      switch (tableName) {
        case 'reference-sheet':
          schema = insertReferenceSheetSchema;
          storageMethod = 'createReferenceSheet';
          break;
        case 'pricelist':
          schema = insertPricelistSchema;
          storageMethod = 'createPricelist';
          break;
        case 'discounts':
          schema = insertDiscountTypeSchema;
          storageMethod = 'createDiscountType';
          break;
        case 'stores':
          schema = insertStoreSchema;
          storageMethod = 'createStore';
          break;
        case 'staff':
          schema = insertStaffSchema;
          storageMethod = 'createStaff';
          break;
        case 'stock-opname':
          schema = insertStockOpnameSchema;
          storageMethod = 'createStockOpname';
          break;
        case 'stock-opname-items':
          schema = insertSoItemListSchema;
          storageMethod = 'createSoItemList';
          break;
        case 'transfers':
          schema = insertTransferOrderSchema;
          storageMethod = 'createTransferOrder';
          break;
        case 'transfer-items':
          schema = insertToItemListSchema;
          storageMethod = 'createToItemList';
          break;
        default:
          return res.status(400).json({ message: 'Invalid table name' });
      }

      // Validate the record
      const validatedRecord = schema.parse(record);
      
      // Insert the record
      if (typeof (storage as any)[storageMethod] === 'function') {
        const result = await (storage as any)[storageMethod](validatedRecord);
        res.json({ success: true, record: result });
      } else {
        throw new Error(`Method ${storageMethod} not implemented`);
      }
      
    } catch (error) {
      console.error('Retry import error:', error);
      res.status(400).json({ 
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Sales entry - SPG, Supervisors can create
  app.post('/api/sales', isAuthenticated, checkRole(['SPG', 'Supervisor', 'Sales Administrator']), async (req, res) => {
    try {
      const validatedData = insertLaporanPenjualanSchema.parse(req.body);

      // Create the sale
      const sale = await storage.createSale(validatedData);

      res.json(sale);
    } catch (error) {
      console.error('Sales creation error:', error);
      res.status(400).json({ message: 'Failed to create sale' });
    }
  });

  // Get sales data
  app.get('/api/sales', isAuthenticated, async (req, res) => {
    try {
      const { kode_gudang, tanggal } = req.query;
      const sales = await storage.getSales(kode_gudang as string, tanggal as string);
      res.json(sales);
    } catch (error) {
      console.error('Get sales error:', error);
      res.status(500).json({ message: 'Failed to get sales data' });
    }
  });

  // Settlement creation - Supervisors and above
  app.post('/api/settlements', isAuthenticated, checkRole(['Supervisor', 'Sales Administrator', 'Finance', 'System Administrator']), async (req, res) => {
    try {
      const validatedData = insertSettlementSchema.parse(req.body);

      // Check if settlement already exists for this store/date
      const existing = await storage.getSettlementByStoreAndDate(
        validatedData.kodeGudang!,
        validatedData.tanggal!
      );

      if (existing) {
        return res.status(400).json({ message: 'Settlement already exists for this store and date' });
      }

      const settlement = await storage.createSettlement(validatedData);
      res.json(settlement);
    } catch (error) {
      console.error('Settlement creation error:', error);
      res.status(400).json({ message: 'Failed to create settlement' });
    }
  });

  // Get settlements
  app.get('/api/settlements', isAuthenticated, async (req, res) => {
    try {
      const { kode_gudang, tanggal } = req.query;
      const settlements = await storage.getSettlements(kode_gudang as string, tanggal as string);
      res.json(settlements);
    } catch (error) {
      console.error('Get settlements error:', error);
      res.status(500).json({ message: 'Failed to get settlements' });
    }
  });

  // Reconciliation endpoint
  app.get('/api/settlements/reconcile', isAuthenticated, async (req, res) => {
    try {
      const { kode_gudang, tanggal } = req.query;
      
      if (!kode_gudang || !tanggal) {
        return res.status(400).json({ message: 'kode_gudang and tanggal are required' });
      }

      // Get settlement for the store/date
      const settlement = await storage.getSettlementByStoreAndDate(
        kode_gudang as string,
        tanggal as string
      );

      if (!settlement) {
        return res.json({ status: 'FAIL', message: 'No settlement found' });
      }

      // Get sales for the day
      const sales = await storage.getSales(kode_gudang as string, tanggal as string);
      const totalSalesAmount = sales.reduce((sum, sale) => 
        sum + parseFloat(sale.discByAmount?.toString() || '0'), 0
      );

      // Simple reconciliation logic
      const expectedCash = parseFloat(settlement.cashAwal?.toString() || '0') + totalSalesAmount;
      const actualCash = parseFloat(settlement.cashAkhir?.toString() || '0');
      const variance = actualCash - expectedCash;

      let status = 'OK';
      if (Math.abs(variance) > 1000) { // Rp 1,000 tolerance
        status = variance > 0 ? 'WARN' : 'FAIL';
      }

      res.json({
        status,
        settlement,
        totalSalesAmount,
        expectedCash,
        actualCash,
        variance
      });

    } catch (error) {
      console.error('Reconciliation error:', error);
      res.status(500).json({ message: 'Failed to perform reconciliation' });
    }
  });

  // Transfer orders - Supervisors and Stockists
  app.post('/api/transfers', isAuthenticated, checkRole(['Supervisor', 'Stockist', 'System Administrator']), async (req, res) => {
    try {
      const validatedData = insertTransferOrderSchema.parse(req.body);
      const transfer = await storage.createTransferOrder(validatedData);
      res.json(transfer);
    } catch (error) {
      console.error('Transfer creation error:', error);
      res.status(400).json({ message: 'Failed to create transfer order' });
    }
  });

  // Get transfer orders
  app.get('/api/transfers', isAuthenticated, async (req, res) => {
    try {
      const transfers = await storage.getTransferOrders();
      res.json(transfers);
    } catch (error) {
      console.error('Get transfers error:', error);
      res.status(500).json({ message: 'Failed to get transfer orders' });
    }
  });

  // Master data endpoints
  app.get('/api/stores', isAuthenticated, async (req, res) => {
    try {
      const stores = await storage.getStores();
      res.json(stores);
    } catch (error) {
      console.error('Get stores error:', error);
      res.status(500).json({ message: 'Failed to get stores' });
    }
  });

  app.post('/api/stores', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const validatedData = insertStoreSchema.parse(req.body);
      const store = await storage.createStore(validatedData);
      res.json(store);
    } catch (error) {
      console.error('Store creation error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create store' });
      }
    }
  });

  app.get('/api/reference-sheets', isAuthenticated, async (req, res) => {
    try {
      const referenceSheets = await storage.getReferenceSheets();
      res.json(referenceSheets);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get reference sheets' });
    }
  });

  app.post('/api/reference-sheets', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const validatedData = insertReferenceSheetSchema.parse(req.body);
      const referenceSheet = await storage.createReferenceSheet(validatedData);
      res.json(referenceSheet);
    } catch (error) {
      console.error('Reference sheet creation error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create reference sheet' });
      }
    }
  });

  app.put('/api/reference-sheets/:refId', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const { refId } = req.params;
      const validatedData = insertReferenceSheetSchema.partial().parse(req.body);
      const referenceSheet = await storage.updateReferenceSheet(parseInt(refId), validatedData);
      res.json(referenceSheet);
    } catch (error) {
      console.error('Reference sheet update error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to update reference sheet' });
      }
    }
  });

  app.delete('/api/reference-sheets/:refId', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const { refId } = req.params;
      await storage.deleteReferenceSheet(parseInt(refId));
      res.json({ success: true });
    } catch (error) {
      console.error('Reference sheet deletion error:', error);
      res.status(500).json({ message: 'Failed to delete reference sheet' });
    }
  });

  app.get('/api/discounts', isAuthenticated, async (req, res) => {
    try {
      const discounts = await storage.getDiscountTypes();
      res.json(discounts);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get discounts' });
    }
  });

  app.post('/api/discounts', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const validatedData = insertDiscountTypeSchema.parse(req.body);
      const discount = await storage.createDiscountType(validatedData);
      res.json(discount);
    } catch (error) {
      console.error('Discount creation error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create discount' });
      }
    }
  });

  app.put('/api/discounts/:discountId', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const { discountId } = req.params;
      const validatedData = insertDiscountTypeSchema.partial().parse(req.body);
      const discount = await storage.updateDiscountType(parseInt(discountId), validatedData);
      res.json(discount);
    } catch (error) {
      console.error('Discount update error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to update discount' });
      }
    }
  });

  app.delete('/api/discounts/:discountId', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const { discountId } = req.params;
      await storage.deleteDiscountType(parseInt(discountId));
      res.json({ success: true });
    } catch (error) {
      console.error('Discount deletion error:', error);
      res.status(500).json({ message: 'Failed to delete discount' });
    }
  });

  app.get('/api/edc', isAuthenticated, async (req, res) => {
    try {
      const edcList = await storage.getEdc();
      res.json(edcList);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get EDC list' });
    }
  });

  app.post('/api/edc', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const validatedData = z.object({
        merchantName: z.string(),
        edcType: z.string()
      }).parse(req.body);
      const edc = await storage.createEdc(validatedData);
      res.json(edc);
    } catch (error) {
      console.error('EDC creation error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create EDC' });
      }
    }
  });

  app.put('/api/edc/:edcId', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const { edcId } = req.params;
      const validatedData = z.object({
        merchantName: z.string().optional(),
        edcType: z.string().optional()
      }).parse(req.body);
      const edc = await storage.updateEdc(parseInt(edcId), validatedData);
      res.json(edc);
    } catch (error) {
      console.error('EDC update error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to update EDC' });
      }
    }
  });

  app.delete('/api/edc/:edcId', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const { edcId } = req.params;
      await storage.deleteEdc(parseInt(edcId));
      res.json({ success: true });
    } catch (error) {
      console.error('EDC deletion error:', error);
      res.status(500).json({ message: 'Failed to delete EDC' });
    }
  });

  app.get('/api/staff', isAuthenticated, async (req, res) => {
    try {
      const staff = await storage.getStaff();
      res.json(staff);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get staff list' });
    }
  });

  app.post('/api/staff', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const validatedData = insertStaffSchema.parse(req.body);
      const staff = await storage.createStaff(validatedData);
      res.json(staff);
    } catch (error) {
      console.error('Staff creation error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create staff' });
      }
    }
  });

  app.put('/api/staff/:employeeId', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const { employeeId } = req.params;
      const validatedData = insertStaffSchema.partial().parse(req.body);
      const staff = await storage.updateStaff(parseInt(employeeId), validatedData);
      res.json(staff);
    } catch (error) {
      console.error('Staff update error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to update staff' });
      }
    }
  });

  app.delete('/api/staff/:employeeId', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const { employeeId } = req.params;
      await storage.deleteStaff(parseInt(employeeId));
      res.json({ success: true });
    } catch (error) {
      console.error('Staff deletion error:', error);
      res.status(500).json({ message: 'Failed to delete staff' });
    }
  });

  // Position endpoints
  app.get('/api/positions', isAuthenticated, async (req, res) => {
    try {
      const positions = await storage.getPositions();
      res.json(positions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get positions' });
    }
  });

  app.post('/api/positions', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const validatedData = insertPositionSchema.parse(req.body);
      const position = await storage.createPosition(validatedData);
      res.json(position);
    } catch (error) {
      console.error('Position creation error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create position' });
      }
    }
  });

  app.put('/api/positions/:positionId', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const { positionId } = req.params;
      const validatedData = insertPositionSchema.partial().parse(req.body);
      const position = await storage.updatePosition(parseInt(positionId), validatedData);
      res.json(position);
    } catch (error) {
      console.error('Position update error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to update position' });
      }
    }
  });

  app.delete('/api/positions/:positionId', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const { positionId } = req.params;
      await storage.deletePosition(parseInt(positionId));
      res.json({ success: true });
    } catch (error) {
      console.error('Position deletion error:', error);
      res.status(500).json({ message: 'Failed to delete position' });
    }
  });

  // Stock Opname endpoints
  app.get('/api/stock-opname', isAuthenticated, async (req, res) => {
    try {
      const stockOpname = await storage.getStockOpname();
      res.json(stockOpname);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get stock opname' });
    }
  });

  app.post('/api/stock-opname', isAuthenticated, checkRole(['Stockist', 'Supervisor', 'System Administrator']), async (req, res) => {
    try {
      const validatedData = insertStockOpnameSchema.parse(req.body);
      const stockOpname = await storage.createStockOpname(validatedData);
      res.json(stockOpname);
    } catch (error) {
      console.error('Stock opname creation error:', error);
      res.status(400).json({ message: 'Failed to create stock opname' });
    }
  });

  app.post('/api/stock-opname-items', isAuthenticated, checkRole(['Stockist', 'Supervisor', 'System Administrator']), async (req, res) => {
    try {
      const validatedData = insertSoItemListSchema.parse(req.body);
      const soItem = await storage.createSoItemList(validatedData);
      res.json(soItem);
    } catch (error) {
      console.error('SO item creation error:', error);
      res.status(400).json({ message: 'Failed to create SO item' });
    }
  });

  // Dashboard metrics
  app.get('/api/dashboard/metrics', isAuthenticated, async (req, res) => {
    try {
      const { kode_gudang } = req.query;
      
      if (!kode_gudang) {
        return res.status(400).json({ message: 'kode_gudang is required' });
      }

      const todaySales = await storage.getSalesToday(kode_gudang as string);
      
      // Get pending settlements (mock implementation)
      const settlements = await storage.getSettlements(kode_gudang as string);
      const pendingSettlements = settlements.filter(s => !s.variance || s.variance === null).length;

      // Get stock alerts (simplified implementation)
      const openingStock = await storage.getOpeningStock();
      const lowStockItems = openingStock.filter(item => (item.qty || 0) < 10).length;

      res.json({
        todaySales: todaySales.totalSales,
        salesCount: todaySales.count,
        pendingSettlements,
        lowStockItems,
        activeTransfers: 0 // Would be calculated based on transfer status
      });

    } catch (error) {
      console.error('Dashboard metrics error:', error);
      res.status(500).json({ message: 'Failed to get dashboard metrics' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
