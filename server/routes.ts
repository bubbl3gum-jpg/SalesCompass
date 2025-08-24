import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { z } from "zod";
import { 
  insertLaporanPenjualanSchema, 
  insertSettlementSchema,
  insertTransferOrderSchema,
  insertStockOpnameSchema,
  insertSoItemListSchema,
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
      res.status(500).json({ message: 'Failed to get stores' });
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

  app.get('/api/discounts', isAuthenticated, async (req, res) => {
    try {
      const discounts = await storage.getDiscountTypes();
      res.json(discounts);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get discounts' });
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
