import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import crypto from 'crypto';
import { z } from "zod";
import { withCache, CACHE_KEYS, CACHE_TTL, invalidateCache, invalidateCachePattern } from "./cache";
import { cache } from "./cache";
import multer from "multer";
import * as XLSX from "xlsx";
import * as csv from "csv-parser";
import { parse as csvParse } from "csv-parse";
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
  toItemList,
  type Pricelist 
} from "@shared/schema";
import { db } from "./db";

// Progress tracking for imports
const importProgress = new Map<string, { current: number; total: number; status: string }>();

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

import { parseCSVContent } from './parseCSV';

// Helper function to parse CSV data for different table types
function parseCSV(buffer: Buffer, tableName?: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    try {
      const csvContent = buffer.toString('utf-8');
      
      // Use enhanced CSV parsing for staff, fallback for others
      if (tableName === 'staff') {
        const results = parseCSVContent(csvContent, tableName);
        resolve(results);
      } else {
        // Fallback parsing for other table types
        const results: any[] = [];
        const stream = Readable.from(csvContent);
        stream
          .pipe(csv.default())
          .on('data', (data: any) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', reject);
      }
    } catch (error) {
      reject(error);
    }
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
            'kode item': 'kodeItem',
            'kodeitem': 'kodeItem',
            'kode_item': 'kodeItem',
            'item code': 'kodeItem',
            'itemcode': 'kodeItem',
            'nama item': 'namaItem',
            'namaitem': 'namaItem',
            'nama_item': 'namaItem',
            'item name': 'namaItem',
            'itemname': 'namaItem',
            'kelompok': 'kelompok',
            'group': 'kelompok',
            'kategori': 'kelompok',
            'category': 'kelompok',
            'family': 'family',
            'keluarga': 'family',
            'original code': 'originalCode',
            'originalcode': 'originalCode',
            'original_code': 'originalCode',
            'kode asli': 'originalCode',
            'kodeasli': 'originalCode',
            'color': 'color',
            'warna': 'color',
            'colours': 'color',
            'kode material': 'kodeMaterial',
            'kodematerial': 'kodeMaterial',
            'kode_material': 'kodeMaterial',
            'material code': 'kodeMaterial',
            'materialcode': 'kodeMaterial',
            'deskripsi material': 'deskripsiMaterial',
            'deskripsimaterial': 'deskripsiMaterial',
            'deskripsi_material': 'deskripsiMaterial',
            'material description': 'deskripsiMaterial',
            'materialdescription': 'deskripsiMaterial',
            'kode motif': 'kodeMotif',
            'kodemotif': 'kodeMotif',
            'kode_motif': 'kodeMotif',
            'motif code': 'kodeMotif',
            'motifcode': 'kodeMotif',
            'pattern code': 'kodeMotif',
            'deskripsi motif': 'deskripsiMotif',
            'deskripsimotif': 'deskripsiMotif',
            'deskripsi_motif': 'deskripsiMotif',
            'motif description': 'deskripsiMotif',
            'motifdescription': 'deskripsiMotif',
            'pattern description': 'deskripsiMotif'
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
            'nama_lengkap': 'namaLengkap',
            'namalengkap': 'namaLengkap',
            'nama lengkap': 'namaLengkap',
            'full name': 'namaLengkap',
            'fullname': 'namaLengkap',
            'tanggal_lahir': 'tanggalLahir',
            'tanggallahir': 'tanggalLahir',
            'tanggal lahir': 'tanggalLahir',
            'date of birth': 'tanggalLahir',
            'dateofbirth': 'tanggalLahir',
            'tanggal_masuk': 'tanggalMasuk',
            'tanggalmasuk': 'tanggalMasuk',
            'tanggal masuk': 'tanggalMasuk',
            'date joined': 'tanggalMasuk',
            'datejoined': 'tanggalMasuk',
            'tempat_lahir': 'tempatLahir',
            'tempatlahir': 'tempatLahir',
            'tempat lahir': 'tempatLahir',
            'place of birth': 'tempatLahir',
            'placeofbirth': 'tempatLahir',
            'no_hp': 'noHp',
            'nohp': 'noHp',
            'no hp': 'noHp',
            'phone number': 'noHp',
            'phone': 'noHp',
            'phonenumber': 'noHp'
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

  // Initialize simple import system
  console.log('🚀 Simple import system initialized');

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Database ping
  app.get('/api/db-ping', (req, res) => {
    res.json({ status: 'connected', timestamp: new Date().toISOString() });
  });

  // Progress tracking endpoints
  app.get('/api/import/progress/:importId', (req, res) => {
    const { importId } = req.params;
    const progress = importProgress.get(importId);
    if (!progress) {
      return res.status(404).json({ message: 'Import not found' });
    }
    res.json(progress);
  });

  // Search endpoints for admin settings
  app.get('/api/search/reference-sheet', isAuthenticated, async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: 'Query parameter required' });
      }
      const results = await storage.searchReferenceSheet(q);
      res.json(results);
    } catch (error) {
      console.error('Search reference sheet error:', error);
      res.status(500).json({ message: 'Search failed' });
    }
  });

  app.get('/api/search/stores', isAuthenticated, async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: 'Query parameter required' });
      }
      const results = await storage.searchStores(q);
      res.json(results);
    } catch (error) {
      console.error('Search stores error:', error);
      res.status(500).json({ message: 'Search failed' });
    }
  });

  app.get('/api/search/staff', isAuthenticated, async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: 'Query parameter required' });
      }
      const results = await storage.searchStaff(q);
      res.json(results);
    } catch (error) {
      console.error('Search staff error:', error);
      res.status(500).json({ message: 'Search failed' });
    }
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
      const cacheKey = `${CACHE_KEYS.USER_PERMISSIONS}_${userEmail}`;
      
      const permissions = await withCache(
        cacheKey,
        CACHE_TTL.USER_PERMISSIONS,
        () => storage.getUserPermissions(userEmail)
      );
      
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
        nik: staff.nik,
        email: staff.email,
        namaLengkap: staff.namaLengkap,
        jabatan: staff.jabatan
      };

      res.json({ 
        message: "Staff authentication successful", 
        staff: {
          nik: staff.nik,
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
        // Get metrics for each store (placeholder for now)
        const metrics = { totalSales: 0, totalItems: 0, totalCustomers: 0 };
        const recentSales: any[] = []; // Get last 5 sales (placeholder)

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

  // Import endpoint for bulk data upload with progress tracking
  // High-performance non-blocking import endpoint (sub-1s response time)
  app.post('/api/import', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const { tableName, additionalData } = req.body;
      if (!tableName) {
        return res.status(400).json({ message: 'Table name is required' });
      }

      // Validate table name
      const validTables = ['reference-sheet', 'staff', 'stores', 'pricelist', 'discounts', 'edc', 'payment-methods', 'positions', 'stock-opname-items', 'transfer-items'];
      if (!validTables.includes(tableName)) {
        return res.status(400).json({ message: 'Invalid table name' });
      }

      console.log(`📂 Processing direct import: ${req.file.originalname} (${tableName})`);

      // Parse additional data if provided
      let parsedAdditionalData = null;
      if (additionalData) {
        try {
          parsedAdditionalData = JSON.parse(additionalData);
        } catch (error) {
          console.error('Failed to parse additional data:', error);
        }
      }

      // Process CSV directly for transfer-items
      if (tableName === 'transfer-items') {
        const csvContent = req.file.buffer.toString('utf-8');
        const { parse } = await import('csv-parse');
        
        const records = await new Promise<any[]>((resolve, reject) => {
          parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
          }, (err, output) => {
            if (err) reject(err);
            else resolve(output);
          });
        });
        
        console.log(`📊 Parsed ${records.length} records from CSV`);
        
        const toNumber = parsedAdditionalData?.toNumber;
        if (!toNumber) {
          return res.status(400).json({ message: 'toNumber is required for transfer items' });
        }
        
        // Insert records directly
        const insertData = records.map(record => ({
          toNumber: toNumber,
          sn: record.sn || record.serial_number || record['Serial Number'] || '',
          kodeItem: record.kode_item || record.item_code || record['Item Code'] || '',
          namaItem: record.nama_item || record.item_name || record['Item Name'] || '',
          qty: parseInt(record.qty || record.quantity || '1') || 1
        })).filter(item => item.sn || item.kodeItem);
        
        if (insertData.length > 0) {
          await db.insert(toItemList).values(insertData);
          console.log(`✅ Inserted ${insertData.length} transfer items`);
        }
        
        return res.json({
          jobId: `direct-${Date.now()}`,
          message: 'Import completed successfully',
          status: 'completed',
          summary: {
            totalRecords: records.length,
            successfulRecords: insertData.length,
            failedRecords: records.length - insertData.length
          }
        });
      }

      res.status(400).json({ message: `Table type ${tableName} not yet supported in direct import` });

    } catch (error) {
      console.error('❌ Direct import error:', error);
      res.status(500).json({ 
        message: 'Import failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });




  // Get all import jobs for monitoring (admin only) - optimized with caching
  app.get('/api/import/jobs', isAuthenticated, (req, res) => {
    // Add cache headers to prevent excessive polling
    res.set('Cache-Control', 'public, max-age=30'); // Cache for 30 seconds
    res.set('ETag', '"empty-jobs"');
    
    // Return 304 Not Modified if client has cached version
    if (req.headers['if-none-match'] === '"empty-jobs"') {
      return res.status(304).send();
    }
    
    res.json([]); // No jobs in direct import mode
  });


  // Production-ready transfer import system
  const { transferImportStorage } = await import('./objectStorage');
  const { transferImportProcessor } = await import('./transferImportProcessor');
  const { pricelistImportProcessor } = await import('./pricelistImportProcessor');
  
  // Initiate transfer import - returns presigned URL for direct S3 upload
  app.post('/api/transfer-imports/initiate', isAuthenticated, async (req, res) => {
    try {
      const { fileName, contentType, expectedSchema } = req.body;
      
      if (!fileName || !contentType) {
        return res.status(400).json({ message: 'fileName and contentType are required' });
      }

      if (expectedSchema !== 'transfer-items') {
        return res.status(400).json({ message: 'Only transfer-items schema is supported' });
      }

      const result = await transferImportStorage.generatePresignedUploadUrl(fileName, contentType);
      
      res.json({
        uploadId: result.uploadId,
        presignedUrl: result.presignedUrl,
        fileKey: result.fileKey,
        expiresInSeconds: result.expiresInSeconds,
        idempotencyKey: `idem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });

    } catch (error) {
      console.error('❌ Transfer import initiate error:', error);
      res.status(500).json({ 
        message: 'Failed to initiate import',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Complete transfer import - starts background processing
  app.post('/api/transfer-imports/complete', isAuthenticated, async (req, res) => {
    try {
      const { uploadId, fileKey, fileSize, fileSha256, idempotencyKey, toNumber } = req.body;
      
      if (!uploadId || !fileKey || !fileSize || !fileSha256 || !idempotencyKey || !toNumber) {
        return res.status(400).json({ 
          message: 'uploadId, fileKey, fileSize, fileSha256, idempotencyKey, and toNumber are required' 
        });
      }

      // Extract filename from fileKey
      const fileName = fileKey.split('/').pop() || 'unknown.csv';

      const job = transferImportProcessor.createJob({
        uploadId,
        fileKey,
        fileName,
        fileSize: parseInt(fileSize),
        fileSha256,
        toNumber: toNumber,
        idempotencyKey
      });

      res.json({
        jobId: uploadId,
        status: job.status
      });

    } catch (error) {
      console.error('❌ Transfer import complete error:', error);
      res.status(500).json({
        message: 'Failed to complete import',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get transfer import status
  app.get('/api/transfer-imports/:uploadId/status', isAuthenticated, (req, res) => {
    try {
      const { uploadId } = req.params;
      const job = transferImportProcessor.getJob(uploadId);
      
      if (!job) {
        return res.status(404).json({ message: 'Import job not found' });
      }

      res.json({
        phase: job.progress.phase,
        rowsTotal: job.progress.rowsTotal,
        rowsParsed: job.progress.rowsParsed,
        rowsValid: job.progress.rowsValid,
        rowsWritten: job.progress.rowsWritten,
        rowsFailed: job.progress.rowsFailed,
        duplicatesSkipped: job.progress.duplicatesSkipped,
        throughputRps: job.progress.throughputRps,
        etaSeconds: job.progress.etaSeconds,
        startedAt: job.progress.startedAt,
        updatedAt: job.progress.updatedAt,
        status: job.status
      });

    } catch (error) {
      console.error('❌ Transfer import status error:', error);
      res.status(500).json({
        message: 'Failed to get import status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Server-sent events for real-time progress updates
  app.get('/api/transfer-imports/:uploadId/events', isAuthenticated, (req, res) => {
    const { uploadId } = req.params;
    const job = transferImportProcessor.getJob(uploadId);
    
    if (!job) {
      return res.status(404).json({ message: 'Import job not found' });
    }

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial status
    res.write(`data: ${JSON.stringify({
      phase: job.progress.phase,
      rowsTotal: job.progress.rowsTotal,
      rowsParsed: job.progress.rowsParsed,
      rowsValid: job.progress.rowsValid,
      rowsWritten: job.progress.rowsWritten,
      rowsFailed: job.progress.rowsFailed,
      throughputRps: job.progress.throughputRps,
      etaSeconds: job.progress.etaSeconds,
      status: job.status
    })}\n\n`);

    // Subscribe to progress updates
    transferImportProcessor.subscribeToProgress(uploadId, (progress) => {
      res.write(`data: ${JSON.stringify({
        phase: progress.phase,
        rowsTotal: progress.rowsTotal,
        rowsParsed: progress.rowsParsed,
        rowsValid: progress.rowsValid,
        rowsWritten: progress.rowsWritten,
        rowsFailed: progress.rowsFailed,
        throughputRps: progress.throughputRps,
        etaSeconds: progress.etaSeconds,
        status: job.status
      })}\n\n`);
    });

    // Clean up on client disconnect
    req.on('close', () => {
      transferImportProcessor.unsubscribeFromProgress(uploadId);
    });
  });

  // Simple direct import system (keep as fallback)

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

  // Create transfer with immediate file import (REQUIRED FILE)
  app.post('/api/transfers/create-with-import', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      const { dariGudang, keGudang, tanggal } = req.body;
      const file = req.file;

      // Validate required fields
      if (!dariGudang || !keGudang || !file) {
        return res.status(400).json({ 
          message: 'Source store, destination store, and file are required' 
        });
      }

      // Validate stores are different
      if (dariGudang === keGudang) {
        return res.status(400).json({ 
          message: 'Source and destination stores must be different' 
        });
      }

      // Step 1: Parse file to extract TO number
      const fileName = file.originalname;
      const isExcel = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls');
      let records: any[] = [];
      
      if (isExcel) {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        records = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
      } else {
        // Parse CSV
        const csvContent = file.buffer.toString('utf-8');
        records = await new Promise((resolve, reject) => {
          const results: any[] = [];
          const parser = csvParse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
          });
          parser.on('data', (data) => results.push(data));
          parser.on('end', () => resolve(results));
          parser.on('error', reject);
        });
      }

      // Extract TO number from file
      const toNumber = transferImportProcessor.extractToNumber(records);
      if (!toNumber) {
        return res.status(400).json({ 
          message: 'Could not extract TO number from file. File must contain "Untuk nomor TO: <NUMBER>" in the first column.' 
        });
      }

      // Step 2: Create transfer order with extracted TO number
      const transferOrder = await storage.createTransferOrder({
        toNumber,
        dariGudang,
        keGudang,
        tanggal: tanggal || new Date().toISOString().split('T')[0],
      });

      // Step 3: Upload file to object storage  
      const contentType = file.mimetype || 'text/csv';
      
      const uploadResult = await transferImportStorage.generatePresignedUploadUrl(fileName, contentType);
      
      // Upload file buffer to presigned URL
      const uploadResponse = await fetch(uploadResult.presignedUrl, {
        method: 'PUT',
        body: file.buffer,
        headers: {
          'Content-Type': contentType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage');
      }

      // Step 4: Create import job using extracted TO number
      const fileSha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
      
      const job = transferImportProcessor.createJob({
        uploadId: uploadResult.uploadId,
        fileKey: uploadResult.fileKey,
        fileName: fileName,
        fileSize: file.size,
        fileSha256,
        toNumber: transferOrder.toNumber,
        idempotencyKey: `create_${toNumber}_${Date.now()}`
      });

      // Wait briefly for initial processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get job status
      const jobStatus = transferImportProcessor.getJob(uploadResult.uploadId);

      res.json({
        toNumber: transferOrder.toNumber,
        transferOrder,
        import: {
          uploadId: uploadResult.uploadId,
          status: jobStatus?.status,
          inserted: jobStatus?.progress.rowsWritten || 0,
          skipped: jobStatus?.progress.duplicatesSkipped || 0,
          errors: jobStatus?.progress.rowsFailed || 0,
        }
      });

    } catch (error) {
      console.error('Transfer creation with import error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to create transfer with import' 
      });
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

  // Get transfer order items
  app.get('/api/transfers/:toNumber/items', isAuthenticated, async (req, res) => {
    try {
      const toNumber = req.params.toNumber;
      if (!toNumber) {
        return res.status(400).json({ message: 'Invalid transfer order number' });
      }
      
      const items = await storage.getToItemListByTransferOrderNumber(toNumber);
      res.json(items);
    } catch (error) {
      console.error('Get transfer items error:', error);
      res.status(500).json({ message: 'Failed to get transfer items' });
    }
  });

  // Delete transfer item
  app.delete('/api/transfers/:toNumber/items/:toItemListId', isAuthenticated, checkRole(['Supervisor', 'Stockist', 'System Administrator']), async (req, res) => {
    try {
      const toNumber = req.params.toNumber;
      const toItemListId = parseInt(req.params.toItemListId);
      
      if (!toNumber || isNaN(toItemListId)) {
        return res.status(400).json({ message: 'Invalid transfer number or item ID' });
      }
      
      await storage.deleteTransferItem(toItemListId, toNumber);
      res.status(204).send();
    } catch (error) {
      console.error('Delete transfer item error:', error);
      res.status(500).json({ message: 'Failed to delete transfer item' });
    }
  });

  // Delete entire transfer order
  app.delete('/api/transfers/:toNumber', isAuthenticated, checkRole(['Supervisor', 'Stockist', 'System Administrator']), async (req, res) => {
    try {
      const toNumber = req.params.toNumber;
      
      if (!toNumber) {
        return res.status(400).json({ message: 'Invalid transfer number' });
      }
      
      // First delete all items
      await storage.deleteAllTransferItems(toNumber);
      // Then delete the transfer order
      await storage.deleteTransferOrder(toNumber);
      
      res.status(204).send();
    } catch (error) {
      console.error('Delete transfer error:', error);
      res.status(500).json({ message: 'Failed to delete transfer order' });
    }
  });

  // Master data endpoints
  app.get('/api/stores', isAuthenticated, async (req, res) => {
    try {
      // Clear cache first to ensure fresh data
      cache.del(CACHE_KEYS.STORES);
      
      const stores = await withCache(
        CACHE_KEYS.STORES,
        CACHE_TTL.STORES,
        () => storage.getStores()
      );
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
      
      // Clear cache after creating store
      cache.del(CACHE_KEYS.STORES);
      
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

  app.put('/api/stores/:kodeGudang', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const { kodeGudang } = req.params;
      const validatedData = insertStoreSchema.partial().parse(req.body);
      const store = await storage.updateStore(kodeGudang, validatedData);
      
      // Clear cache after updating store
      cache.del(CACHE_KEYS.STORES);
      
      res.json(store);
    } catch (error) {
      console.error('Store update error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to update store' });
      }
    }
  });

  app.delete('/api/stores/:kodeGudang', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const { kodeGudang } = req.params;
      await storage.deleteStore(kodeGudang);
      
      // Clear cache after deleting store
      cache.del(CACHE_KEYS.STORES);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Store deletion error:', error);
      res.status(500).json({ message: 'Failed to delete store' });
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
      const referenceSheet = await storage.updateReferenceSheet(refId, validatedData);
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
      await storage.deleteReferenceSheet(refId);
      res.json({ success: true });
    } catch (error) {
      console.error('Reference sheet deletion error:', error);
      res.status(500).json({ message: 'Failed to delete reference sheet' });
    }
  });

  app.get('/api/discounts', isAuthenticated, async (req, res) => {
    try {
      const discounts = await withCache(
        CACHE_KEYS.DISCOUNTS,
        CACHE_TTL.DISCOUNTS,
        () => storage.getDiscountTypes()
      );
      res.json(discounts);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get discounts' });
    }
  });

  app.post('/api/discounts', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const validatedData = insertDiscountTypeSchema.parse(req.body);
      // Convert number to string for storage
      const storageData = {
        ...validatedData,
        discountAmount: validatedData.discountAmount.toString()
      };
      const discount = await storage.createDiscountType(storageData);
      
      // Clear cache after creating discount
      cache.del(CACHE_KEYS.DISCOUNTS);
      
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
      // Convert number to string for storage if discountAmount exists
      const storageData = {
        ...validatedData,
        ...(validatedData.discountAmount !== undefined && {
          discountAmount: String(validatedData.discountAmount)
        })
      };
      const discount = await storage.updateDiscountType(parseInt(discountId), storageData);
      
      // Clear cache after updating discount
      cache.del(CACHE_KEYS.DISCOUNTS);
      
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
      
      // Clear cache after deleting discount
      cache.del(CACHE_KEYS.DISCOUNTS);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Discount deletion error:', error);
      res.status(500).json({ message: 'Failed to delete discount' });
    }
  });

  // Pricelist endpoints
  app.get('/api/pricelist', isAuthenticated, async (req, res) => {
    try {
      const { page = 1, limit = 50, search = '' } = req.query;
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit as string) || 50));
      const searchTerm = search as string;

      // Clear cache first to ensure fresh data
      cache.del(CACHE_KEYS.PRICELIST || 'pricelist');
      
      // Use cache for pricelist data
      const allPricelist = await withCache(
        CACHE_KEYS.PRICELIST || 'pricelist',
        CACHE_TTL.PRICELIST || 1800, // 30 minutes
        () => storage.getPricelist()
      );

      // Apply search filter
      let filteredPricelist = allPricelist;
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredPricelist = allPricelist.filter((item: any) => 
          item.kodeItem?.toLowerCase().includes(searchLower) ||
          item.sn?.toLowerCase().includes(searchLower) ||
          item.family?.toLowerCase().includes(searchLower) ||
          item.kelompok?.toLowerCase().includes(searchLower) ||
          item.deskripsiMaterial?.toLowerCase().includes(searchLower) ||
          item.namaMotif?.toLowerCase().includes(searchLower) ||
          item.kodeMotif?.toLowerCase().includes(searchLower)
        );
      }

      // Apply pagination
      const offset = (pageNum - 1) * limitNum;
      const paginatedData = filteredPricelist.slice(offset, offset + limitNum);

      res.json({
        data: paginatedData,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: filteredPricelist.length,
          totalPages: Math.ceil(filteredPricelist.length / limitNum)
        }
      });
    } catch (error) {
      console.error('Get pricelist error:', error);
      res.status(500).json({ message: 'Failed to get pricelist' });
    }
  });

  app.post('/api/pricelist', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const validatedData = insertPricelistSchema.parse(req.body);
      const pricelistItem = await storage.createPricelist(validatedData);
      
      // Clear cache after creating pricelist item
      cache.del(CACHE_KEYS.PRICELIST || 'pricelist');
      
      res.json(pricelistItem);
    } catch (error) {
      console.error('Pricelist creation error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create pricelist item' });
      }
    }
  });

  app.put('/api/pricelist/:pricelistId', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const { pricelistId } = req.params;
      const validatedData = insertPricelistSchema.partial().parse(req.body);
      // Note: Update method would need to be added to storage interface
      const pricelistItem = await storage.updatePricelist ? 
        await storage.updatePricelist(parseInt(pricelistId), validatedData) :
        null;
      
      if (!pricelistItem) {
        return res.status(404).json({ message: 'Pricelist item not found or update not implemented' });
      }
      
      // Clear cache after updating pricelist item
      cache.del(CACHE_KEYS.PRICELIST || 'pricelist');
      
      res.json(pricelistItem);
    } catch (error) {
      console.error('Pricelist update error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to update pricelist item' });
      }
    }
  });

  app.delete('/api/pricelist/:pricelistId', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const { pricelistId } = req.params;
      // Note: Delete method would need to be added to storage interface
      const success = await storage.deletePricelist ? 
        await storage.deletePricelist(parseInt(pricelistId)) :
        false;
      
      if (!success) {
        return res.status(404).json({ message: 'Pricelist item not found or delete not implemented' });
      }
      
      // Clear cache after deleting pricelist item
      cache.del(CACHE_KEYS.PRICELIST || 'pricelist');
      
      res.json({ success: true });
    } catch (error) {
      console.error('Pricelist deletion error:', error);
      res.status(500).json({ message: 'Failed to delete pricelist item' });
    }
  });

  // Pricelist import endpoints (following Transfer import pattern)
  app.post('/api/pricelist-imports/initiate', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const { fileName, contentType, expectedSchema } = req.body;
      
      if (!fileName || !contentType) {
        return res.status(400).json({ message: 'fileName and contentType are required' });
      }

      if (expectedSchema !== 'pricelist') {
        return res.status(400).json({ message: 'Only pricelist schema is supported' });
      }

      const result = await transferImportStorage.generatePresignedUploadUrl(fileName, contentType);
      
      res.json({
        uploadId: result.uploadId,
        presignedUrl: result.presignedUrl,
        fileKey: result.fileKey,
        expiresInSeconds: result.expiresInSeconds,
        idempotencyKey: `idem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });

    } catch (error) {
      console.error('❌ Pricelist import initiate error:', error);
      res.status(500).json({ 
        message: 'Failed to initiate pricelist import',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/pricelist-imports/complete', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const { uploadId, fileKey, fileSize, fileSha256, idempotencyKey } = req.body;
      
      if (!uploadId || !fileKey || !fileSize || !fileSha256 || !idempotencyKey) {
        return res.status(400).json({ 
          message: 'uploadId, fileKey, fileSize, fileSha256, and idempotencyKey are required' 
        });
      }

      console.log('📦 Pricelist import complete request:', { uploadId, fileKey, fileSize });

      // Extract filename from fileKey
      const fileName = fileKey.split('/').pop() || 'unknown.csv';

      // Extract the actual object name from the fileKey
      // fileKey format: /bucket_name/path/to/file
      let objectName = fileKey;
      if (fileKey.startsWith('/')) {
        const parts = fileKey.split('/');
        parts.shift(); // Remove empty string from leading /
        const bucketName = parts.shift(); // Remove bucket name
        objectName = parts.join('/');
        console.log('🔗 Parsed bucket:', bucketName, 'object:', objectName);
      } else {
        console.log('⚠️ FileKey does not start with /, using as-is:', fileKey);
      }

      console.log('🗂️ Final object name:', objectName);

      try {
        // Use the proper method to get the import file
        console.log('🔍 Getting import file from storage...');
        const objectFile = await transferImportStorage.getImportFile(fileKey);
        
        // Check if file exists before processing
        const [exists] = await objectFile.exists();
        if (!exists) {
          console.error('❌ Object file does not exist:', fileKey);
          return res.status(404).json({ 
            message: 'Uploaded file not found in storage',
            fileKey,
            objectName 
          });
        }
        
        console.log('✅ Object file exists, starting import processing...');

        // Start processing in the background
        pricelistImportProcessor.startImport(uploadId, fileName, objectFile).catch(error => {
          console.error('❌ Background import error:', error);
        });
      } catch (fileError) {
        console.error('❌ Error accessing object file:', fileError);
        return res.status(500).json({
          message: 'Failed to access uploaded file',
          error: fileError instanceof Error ? fileError.message : 'Unknown error'
        });
      }

      res.json({
        jobId: uploadId,
        status: 'processing'
      });

    } catch (error) {
      console.error('❌ Pricelist import complete error:', error);
      res.status(500).json({
        message: 'Failed to complete pricelist import',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/pricelist-imports/:uploadId/status', isAuthenticated, async (req, res) => {
    try {
      const { uploadId } = req.params;
      const job = pricelistImportProcessor.getJob(uploadId);
      
      if (!job) {
        return res.status(404).json({ message: 'Pricelist import job not found' });
      }

      res.json({
        status: job.status,
        progress: job.progress,
        errors: job.errors,
        startedAt: job.startedAt,
        updatedAt: job.updatedAt
      });
    } catch (error) {
      console.error('❌ Get pricelist import status error:', error);
      res.status(500).json({ message: 'Failed to get import status' });
    }
  });

  // Get all pricelist import jobs
  app.get('/api/pricelist-imports/jobs', isAuthenticated, async (req, res) => {
    try {
      // Return empty array for now - this endpoint is used by the UI for job listings
      res.json([]);
    } catch (error) {
      console.error('❌ Get pricelist import jobs error:', error);
      res.status(500).json({ message: 'Failed to get import jobs' });
    }
  });

  app.get('/api/pricelist-imports/:uploadId/events', isAuthenticated, (req, res) => {
    const { uploadId } = req.params;
    const job = pricelistImportProcessor.getJob(uploadId);
    
    if (!job) {
      return res.status(404).json({ message: 'Pricelist import job not found' });
    }

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial status
    res.write(`data: ${JSON.stringify({
      phase: job.progress.phase,
      rowsParsed: job.progress.rowsParsed,
      rowsValid: job.progress.rowsValid,
      rowsWritten: job.progress.rowsWritten,
      rowsFailed: job.progress.rowsFailed,
      throughputRps: job.progress.throughputRps,
      eta: job.progress.eta,
      status: job.status
    })}\n\n`);

    // Subscribe to progress updates
    const progressListener = (jobUploadId: string, updatedJob: any) => {
      if (jobUploadId === uploadId) {
        res.write(`data: ${JSON.stringify({
          phase: updatedJob.progress.phase,
          rowsParsed: updatedJob.progress.rowsParsed,
          rowsValid: updatedJob.progress.rowsValid,
          rowsWritten: updatedJob.progress.rowsWritten,
          rowsFailed: updatedJob.progress.rowsFailed,
          throughputRps: updatedJob.progress.throughputRps,
          eta: updatedJob.progress.eta,
          status: updatedJob.status
        })}\n\n`);
      }
    };

    pricelistImportProcessor.on('progress', progressListener);

    // Clean up on client disconnect
    req.on('close', () => {
      pricelistImportProcessor.removeListener('progress', progressListener);
    });
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

  app.put('/api/staff/:nik', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const { nik } = req.params;
      const validatedData = insertStaffSchema.partial().parse(req.body);
      const staff = await storage.updateStaff(nik, validatedData);
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

  app.delete('/api/staff/:nik', isAuthenticated, checkRole(['System Administrator']), async (req, res) => {
    try {
      const { nik } = req.params;
      await storage.deleteStaff(nik);
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
