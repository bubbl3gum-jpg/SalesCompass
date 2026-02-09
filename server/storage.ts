import {
  users,
  referenceSheet,
  stores,
  discountTypes,
  pricelist,
  laporanPenjualan,
  settlements,
  transferOrders,
  toItemList,
  stockOpname,
  soItemList,
  edc,
  storeEdc,
  edcSettlement,
  storeDiscounts,
  staff,
  positions,
  stock,
  virtualStoreInventory,
  bazars,
  storeTypes,
  type User,
  type UpsertUser,
  type ReferenceSheet,
  type Store,
  type DiscountType,
  type Pricelist,
  type LaporanPenjualan,
  type Settlement,
  type TransferOrder,
  type ToItemList,
  type StockOpname,
  type SoItemList,
  type Edc,
  type StoreEdc,
  type EdcSettlement,
  type Staff,
  type Position,
  type InsertReferenceSheet,
  type InsertStore,
  type InsertDiscountType,
  type InsertPricelist,
  type InsertLaporanPenjualan,
  type InsertSettlement,
  type InsertTransferOrder,
  type InsertToItemList,
  type InsertStockOpname,
  type InsertSoItemList,
  type InsertEdc,
  type InsertStoreEdc,
  type InsertEdcSettlement,
  type InsertStaff,
  type InsertPosition,
  type Stock,
  type InsertStock,
  type VirtualStoreInventory,
  type InsertVirtualStoreInventory,
  type Bazar,
  type InsertBazar,
  type StoreDiscount,
  type StoreType,
  type InsertStoreType,
  bazarTypes,
  type BazarType,
  type InsertBazarType,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, sum, or, ilike, inArray, gt } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Reference Sheet operations
  getReferenceSheets(): Promise<ReferenceSheet[]>;
  createReferenceSheet(data: InsertReferenceSheet): Promise<ReferenceSheet>;
  updateReferenceSheet(kodeItem: string, data: Partial<InsertReferenceSheet>): Promise<ReferenceSheet>;
  deleteReferenceSheet(kodeItem: string): Promise<void>;
  getReferenceSheetByKodeItem(kodeItem: string): Promise<ReferenceSheet | undefined>;
  bulkInsertReferenceSheet(data: InsertReferenceSheet[]): Promise<{ 
    success: number; 
    errors: Array<{ row: number; error: string; data: any }>;
    duplicatesInBatch: Array<{ row: number; kodeItem: string; duplicateRows: number[] }>;
    summary: {
      totalRecords: number;
      newRecords: number;
      updatedRecords: number;
      duplicatesRemoved: number;
      errorRecords: number;
    }
  }>;
  searchReferenceSheet(query: string): Promise<ReferenceSheet[]>;

  // Store operations
  getStores(): Promise<Store[]>;
  createStore(data: InsertStore): Promise<Store>;
  updateStore(kodeGudang: string, data: Partial<InsertStore>): Promise<Store>;
  deleteStore(kodeGudang: string): Promise<void>;
  getStoreByKode(kodeGudang: string): Promise<Store | undefined>;
  searchStores(query: string): Promise<Store[]>;
  getStoreEdcByStore(kodeGudang: string): Promise<StoreEdc[]>;
  deleteStoreEdc(storeEdcId: number): Promise<void>;

  // Store Type management operations
  getStoreTypes(): Promise<StoreType[]>;
  createStoreType(data: InsertStoreType): Promise<StoreType>;
  updateStoreType(id: number, data: Partial<InsertStoreType>): Promise<StoreType>;
  deleteStoreType(id: number): Promise<void>;

  // Bazar Type management operations
  getBazarTypes(): Promise<BazarType[]>;
  createBazarType(data: InsertBazarType): Promise<BazarType>;
  updateBazarType(id: number, data: Partial<InsertBazarType>): Promise<BazarType>;
  deleteBazarType(id: number): Promise<void>;

  // Discount operations
  getDiscountTypes(): Promise<DiscountType[]>;
  createDiscountType(data: InsertDiscountType): Promise<DiscountType>;
  updateDiscountType(discountId: number, data: Partial<InsertDiscountType>): Promise<DiscountType>;
  deleteDiscountType(discountId: number): Promise<void>;

  // Store Discount operations
  getStoreDiscounts(): Promise<any[]>;
  getDiscountsByStore(kodeGudang: string): Promise<DiscountType[]>;
  assignDiscountToStore(kodeGudang: string, discountId: number): Promise<StoreDiscount>;
  removeDiscountFromStore(storeDiscountsId: number): Promise<void>;

  // Pricelist operations
  getPricelist(): Promise<Pricelist[]>;
  createPricelist(data: InsertPricelist): Promise<Pricelist>;
  updatePricelist(pricelistId: number, data: Partial<InsertPricelist>): Promise<Pricelist>;
  deletePricelist(pricelistId: number): Promise<void>;
  getPriceBySerial(serialNumber: string): Promise<Pricelist | undefined>;
  getPriceByKodeItem(kodeItem: string): Promise<Pricelist | undefined>;
  getPricesByFamilyAndMaterial(family: string, deskripsiMaterial: string): Promise<Pricelist[]>;
  getEnhancedPriceForItem(kodeItem: string, serialNumber?: string): Promise<Pricelist | undefined>;

  // Sales operations
  createSale(data: InsertLaporanPenjualan): Promise<LaporanPenjualan>;
  getSales(kodeGudang?: string, tanggal?: string): Promise<LaporanPenjualan[]>;
  getSalesToday(kodeGudang?: string): Promise<{ totalSales: string, count: number }>;
  getSaleById(penjualanId: number): Promise<LaporanPenjualan | undefined>;
  updateSale(penjualanId: number, data: Partial<InsertLaporanPenjualan>): Promise<LaporanPenjualan>;
  deleteSale(penjualanId: number): Promise<void>;

  // Settlement operations
  createSettlement(data: InsertSettlement): Promise<Settlement>;
  getSettlements(kodeGudang?: string, tanggal?: string): Promise<Settlement[]>;
  getSettlementByStoreAndDate(kodeGudang: string, tanggal: string): Promise<Settlement | undefined>;
  getSettlementByBazarAndDate(bazarId: number, tanggal: string): Promise<Settlement | undefined>;
  updateSettlement(id: number, data: Partial<InsertSettlement>): Promise<Settlement>;
  deleteSettlement(id: number): Promise<void>;
  deleteEdcSettlementsBySettlementId(settlementId: number): Promise<void>;

  
  // Stock Opname operations
  getStockOpname(): Promise<StockOpname[]>;
  createStockOpname(data: InsertStockOpname): Promise<StockOpname>;
  createSoItemList(data: InsertSoItemList): Promise<SoItemList>;
  getSoItemListByStockOpnameId(soId: number): Promise<SoItemList[]>;

  // Transfer operations
  createTransferOrder(data: InsertTransferOrder): Promise<TransferOrder>;
  getTransferOrders(): Promise<TransferOrder[]>;
  updateTransferOrder(toNumber: string, data: Partial<InsertTransferOrder>): Promise<TransferOrder>;
  updateTransferItem(toItemListId: number, data: Partial<InsertToItemList>): Promise<ToItemList>;
  deleteTransferItem(toItemListId: number, toNumber: string): Promise<void>;
  deleteAllTransferItems(toNumber: string): Promise<void>;
  deleteTransferOrder(toNumber: string): Promise<void>;

  // EDC operations
  getEdc(): Promise<Edc[]>;
  createEdc(data: InsertEdc): Promise<Edc>;
  updateEdc(edcId: number, data: Partial<InsertEdc>): Promise<Edc>;
  deleteEdc(edcId: number): Promise<void>;
  getStoreEdc(): Promise<StoreEdc[]>;
  createStoreEdc(data: InsertStoreEdc): Promise<StoreEdc>;
  createEdcSettlement(data: InsertEdcSettlement): Promise<EdcSettlement>;
  getEdcSettlementsBySettlementIds(settlementIds: number[]): Promise<EdcSettlement[]>;

  // Staff operations
  getStaff(): Promise<Staff[]>;
  createStaff(data: InsertStaff): Promise<Staff>;
  updateStaff(nik: string, data: Partial<InsertStaff>): Promise<Staff>;
  deleteStaff(nik: string): Promise<void>;
  bulkInsertStaff(data: InsertStaff[]): Promise<void>;
  searchStaff(query: string): Promise<Staff[]>;
  getStaffByEmail(email: string): Promise<Staff | undefined>;
  getStaffByNik(nik: string): Promise<Staff | undefined>;

  // Position operations
  getPositions(): Promise<Position[]>;
  createPosition(data: InsertPosition): Promise<Position>;
  updatePosition(positionId: number, data: Partial<InsertPosition>): Promise<Position>;
  deletePosition(positionId: number): Promise<void>;
  getPositionByName(positionName: string): Promise<Position | undefined>;
  getUserPermissions(userEmail: string): Promise<Position | null>;
  
  // Transfer order item list operations
  createToItemList(data: InsertToItemList): Promise<ToItemList>;
  getToItemListByTransferOrderNumber(toNumber: string): Promise<ToItemList[]>;
  processTransferToStock(toNumber: string): Promise<{ processed: number; errors: string[] }>;
  getUnprocessedTransfers(): Promise<{ toNumber: string; tanggal: string | null; dariGudang: string; keGudang: string; itemCount: number }[]>;
  batchProcessTransfersToStock(): Promise<{ totalProcessed: number; successfulTransfers: string[]; failedTransfers: { toNumber: string; error: string }[]; totalItems: number }>;

  // Inventory search operations
  searchInventoryBySerial(storeCode: string, serialNumber: string): Promise<any[]>;
  searchInventoryByDetails(storeCode: string, searchQuery: string): Promise<any[]>;

  // Stock operations
  getStockOnHand(kodeGudang?: string): Promise<Array<{
    stockId: number;
    kodeGudang: string;
    serialNumber: string;
    kodeItem: string;
    qty: number;
    tanggalIn: string | null;
  }>>;
  getStockWithoutPricing(kodeGudang?: string): Promise<Array<{
    stockId: number;
    kodeGudang: string;
    serialNumber: string;
    kodeItem: string;
    qty: number;
    tanggalIn: string | null;
  }>>;
  getStockSoldToday(kodeGudang?: string): Promise<Array<{
    kodeItem: string;
    serialNumber: string;
    qty: number;
    tanggalOut: string | null;
  }>>;
  getLowStockItems(kodeGudang?: string): Promise<Array<{
    stockId: number;
    kodeGudang: string;
    serialNumber: string;
    kodeItem: string;
    qty: number;
    tanggalIn: string | null;
  }>>;
  getInboundStock(kodeGudang?: string): Promise<Array<{
    toNumber: string;
    kodeItem: string;
    namaItem: string | null;
    qty: number;
    fromStore: string;
    tanggal: string | null;
  }>>;
  getStockOverview(storeId?: string, limitItems?: number): Promise<{
    stores: Array<{ kodeGudang: string; onHand: number }>;
    activeStore: { kodeGudang: string; onHand: number; topItems: Array<{ kodeItem: string; qtyOnHand: number }> } | null;
  }>;
  getStockMovements(storeId?: string, from?: string, to?: string): Promise<{
    range: { from: string; to: string };
    storeId?: string;
    in: Array<{ date: string; count: number }>;
    out: Array<{ date: string; count: number }>;
  }>;
  updateStockOnSale(serialNumber: string, kodeGudang: string, saleDate: string): Promise<boolean>;

  // Missing price operations
  getItemsWithMissingPrices(): Promise<Array<{
    kodeItem: string;
    namaItem: string | null;
    family: string | null;
    deskripsiMaterial: string | null;
    issue: 'no_pricelist' | 'zero_price' | 'null_price';
  }>>;

  // Virtual Store Inventory operations
  getVirtualStoreInventory(kodeGudang?: string): Promise<VirtualStoreInventory[]>;
  getVirtualStoreInventoryBySn(kodeGudang: string, sn: string): Promise<VirtualStoreInventory | undefined>;
  createVirtualStoreInventory(data: InsertVirtualStoreInventory): Promise<VirtualStoreInventory>;
  bulkCreateVirtualStoreInventory(data: InsertVirtualStoreInventory[]): Promise<{ success: number; errors: string[] }>;
  updateVirtualStoreInventory(inventoryId: number, data: Partial<InsertVirtualStoreInventory>): Promise<VirtualStoreInventory>;
  deleteVirtualStoreInventory(inventoryId: number): Promise<void>;
  adjustVirtualStoreInventoryQty(kodeGudang: string, sn: string, qtyChange: number): Promise<VirtualStoreInventory | null>;
  transferVirtualInventory(fromStore: string, toStore: string, sn: string, qty: number): Promise<{ success: boolean; error?: string }>;
  addToVirtualInventory(kodeGudang: string, item: { sn: string; kodeItem?: string | null; namaBarang?: string | null; qty: number }): Promise<VirtualStoreInventory>;

  // Bazar operations
  getBazars(): Promise<Bazar[]>;
  getBazarById(bazarId: number): Promise<Bazar | undefined>;
  getActiveBazars(): Promise<Bazar[]>;
  createBazar(data: InsertBazar): Promise<Bazar>;
  updateBazar(bazarId: number, data: Partial<InsertBazar>): Promise<Bazar>;
  deleteBazar(bazarId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Reference Sheet operations
  async getReferenceSheets(): Promise<ReferenceSheet[]> {
    return await db.select().from(referenceSheet);
  }

  async createReferenceSheet(data: InsertReferenceSheet): Promise<ReferenceSheet> {
    const [result] = await db.insert(referenceSheet).values(data).returning();
    return result;
  }

  async updateReferenceSheet(kodeItem: string, data: Partial<InsertReferenceSheet>): Promise<ReferenceSheet> {
    const [result] = await db.update(referenceSheet)
      .set(data)
      .where(eq(referenceSheet.kodeItem, kodeItem))
      .returning();
    return result;
  }

  async deleteReferenceSheet(kodeItem: string): Promise<void> {
    await db.delete(referenceSheet).where(eq(referenceSheet.kodeItem, kodeItem));
  }

  // Enhanced bulk insert with detailed debugging and error handling
  async bulkInsertReferenceSheet(data: InsertReferenceSheet[]): Promise<{ 
    success: number; 
    errors: Array<{ row: number; error: string; data: any }>;
    duplicatesInBatch: Array<{ row: number; kodeItem: string; duplicateRows: number[] }>;
    summary: {
      totalRecords: number;
      newRecords: number;
      updatedRecords: number;
      duplicatesRemoved: number;
      errorRecords: number;
    }
  }> {
    const errors: Array<{ row: number; error: string; data: any }> = [];
    const duplicatesInBatch: Array<{ row: number; kodeItem: string; duplicateRows: number[] }> = [];
    let success = 0;
    let newRecords = 0;
    let updatedRecords = 0;

    console.log(`\n=== BULK INSERT DEBUG ===`);
    console.log(`Total records to process: ${data.length}`);

    // Step 1: Remove duplicates within the same batch and track them
    const uniqueData = [];
    const seenKeys = new Map<string, number>();
    
    for (let i = 0; i < data.length; i++) {
      const kodeItem = data[i].kodeItem;
      if (seenKeys.has(kodeItem)) {
        const originalRow = seenKeys.get(kodeItem)!;
        let existingDuplicate = duplicatesInBatch.find(d => d.kodeItem === kodeItem);
        if (existingDuplicate) {
          existingDuplicate.duplicateRows.push(i + 1);
        } else {
          duplicatesInBatch.push({
            row: originalRow,
            kodeItem: kodeItem,
            duplicateRows: [i + 1]
          });
        }
        console.log(`Duplicate found in batch: "${kodeItem}" at rows ${originalRow} and ${i + 1}`);
      } else {
        seenKeys.set(kodeItem, i + 1);
        uniqueData.push(data[i]);
      }
    }

    console.log(`After removing duplicates: ${uniqueData.length} unique records`);
    console.log(`Duplicates in batch: ${duplicatesInBatch.length} sets`);

    // Step 2: Check which records already exist in database
    const existingRecords = new Set();
    if (uniqueData.length > 0) {
      const kodeItems = uniqueData.map(item => item.kodeItem);
      const existing = await db
        .select({ kodeItem: referenceSheet.kodeItem })
        .from(referenceSheet)
        .where(inArray(referenceSheet.kodeItem, kodeItems));
      
      existing.forEach(record => existingRecords.add(record.kodeItem));
      console.log(`Existing records in database: ${existingRecords.size}`);
      console.log(`New records to insert: ${uniqueData.length - existingRecords.size}`);
    }

    // Step 3: Process in smaller batches to avoid timeout
    const batchSize = 50;
    for (let i = 0; i < uniqueData.length; i += batchSize) {
      const batch = uniqueData.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}: records ${i + 1} to ${Math.min(i + batchSize, uniqueData.length)}`);
      
      try {
        const result = await db
          .insert(referenceSheet)
          .values(batch)
          .onConflictDoUpdate({
            target: referenceSheet.kodeItem,
            set: {
              namaItem: sql.raw('excluded.nama_item'),
              kelompok: sql.raw('excluded.kelompok'),
              family: sql.raw('excluded.family'),
              originalCode: sql.raw('excluded.original_code'),
              color: sql.raw('excluded.color'),
              kodeMaterial: sql.raw('excluded.kode_material'),
              deskripsiMaterial: sql.raw('excluded.deskripsi_material'),
              kodeMotif: sql.raw('excluded.kode_motif'),
              deskripsiMotif: sql.raw('excluded.deskripsi_motif'),
            },
          })
          .returning({ kodeItem: referenceSheet.kodeItem });

        const batchSuccess = result.length;
        success += batchSuccess;
        
        // Count new vs updated records
        batch.forEach(item => {
          if (existingRecords.has(item.kodeItem)) {
            updatedRecords++;
          } else {
            newRecords++;
          }
        });
        
        console.log(`Batch processed: ${batchSuccess} records successful`);
      } catch (error) {
        console.error(`Batch failed, falling back to individual inserts:`, error);
        
        // If batch fails, fall back to individual inserts with detailed error reporting
        for (let j = 0; j < batch.length; j++) {
          const globalIndex = i + j;
          try {
            await db
              .insert(referenceSheet)
              .values(batch[j])
              .onConflictDoUpdate({
                target: referenceSheet.kodeItem,
                set: {
                  namaItem: sql.raw('excluded.nama_item'),
                  kelompok: sql.raw('excluded.kelompok'),
                  family: sql.raw('excluded.family'),
                  originalCode: sql.raw('excluded.original_code'),
                  color: sql.raw('excluded.color'),
                  kodeMaterial: sql.raw('excluded.kode_material'),
                  deskripsiMaterial: sql.raw('excluded.deskripsi_material'),
                  kodeMotif: sql.raw('excluded.kode_motif'),
                  deskripsiMotif: sql.raw('excluded.deskripsi_motif'),
                },
              });
            success++;
            
            if (existingRecords.has(batch[j].kodeItem)) {
              updatedRecords++;
            } else {
              newRecords++;
            }
          } catch (itemError) {
            const errorMsg = itemError instanceof Error ? itemError.message : String(itemError);
            console.error(`Row ${globalIndex + 1} failed:`, errorMsg, batch[j]);
            errors.push({ 
              row: globalIndex + 1, 
              error: errorMsg,
              data: batch[j]
            });
          }
        }
      }
    }

    const summary = {
      totalRecords: data.length,
      newRecords,
      updatedRecords,
      duplicatesRemoved: duplicatesInBatch.reduce((acc, curr) => acc + curr.duplicateRows.length, 0),
      errorRecords: errors.length
    };

    console.log(`\n=== IMPORT SUMMARY ===`);
    console.log(`Total records processed: ${summary.totalRecords}`);
    console.log(`New records added: ${summary.newRecords}`);
    console.log(`Existing records updated: ${summary.updatedRecords}`);
    console.log(`Duplicates in batch removed: ${summary.duplicatesRemoved}`);
    console.log(`Records with errors: ${summary.errorRecords}`);
    console.log(`Successfully processed: ${success}`);
    console.log(`========================\n`);

    return { success, errors, duplicatesInBatch, summary };
  }

  // Search functionality for reference sheet
  async searchReferenceSheet(query: string): Promise<ReferenceSheet[]> {
    return await db.select().from(referenceSheet)
      .where(
        or(
          ilike(referenceSheet.kodeItem, `%${query}%`),
          ilike(referenceSheet.namaItem, `%${query}%`),
          ilike(referenceSheet.kelompok, `%${query}%`),
          ilike(referenceSheet.family, `%${query}%`)
        )
      )
      .limit(100);
  }

  async getReferenceSheetByKodeItem(kodeItem: string): Promise<ReferenceSheet | undefined> {
    const [result] = await db.select().from(referenceSheet).where(eq(referenceSheet.kodeItem, kodeItem));
    return result;
  }

  // Store operations
  async getStores(): Promise<Store[]> {
    return await db.select().from(stores);
  }

  async createStore(data: InsertStore): Promise<Store> {
    const [result] = await db.insert(stores).values(data).returning();
    return result;
  }

  async deleteStore(kodeGudang: string): Promise<void> {
    await db.delete(stores).where(eq(stores.kodeGudang, kodeGudang));
  }

  async getStoreByKode(kodeGudang: string): Promise<Store | undefined> {
    const [result] = await db.select().from(stores).where(eq(stores.kodeGudang, kodeGudang));
    return result;
  }

  async updateStore(kodeGudang: string, data: Partial<InsertStore>): Promise<Store> {
    const [result] = await db.update(stores)
      .set(data)
      .where(eq(stores.kodeGudang, kodeGudang))
      .returning();
    return result;
  }

  // Discount operations
  async getDiscountTypes(): Promise<DiscountType[]> {
    return await db.select().from(discountTypes);
  }

  async createDiscountType(data: InsertDiscountType): Promise<DiscountType> {
    const [result] = await db.insert(discountTypes).values(data).returning();
    return result;
  }

  async updateDiscountType(discountId: number, data: Partial<InsertDiscountType>): Promise<DiscountType> {
    const [result] = await db.update(discountTypes)
      .set(data)
      .where(eq(discountTypes.discountId, discountId))
      .returning();
    return result;
  }

  async deleteDiscountType(discountId: number): Promise<void> {
    await db.delete(discountTypes).where(eq(discountTypes.discountId, discountId));
  }

  // Store Discount operations
  async getStoreDiscounts(): Promise<any[]> {
    const results = await db
      .select({
        storeDiscountsId: storeDiscounts.storeDiscountsId,
        kodeGudang: storeDiscounts.kodeGudang,
        discountId: storeDiscounts.discountId,
        namaGudang: stores.namaGudang,
        discountName: discountTypes.discountName,
        discountType: discountTypes.discountType,
        discountAmount: discountTypes.discountAmount,
        startFrom: discountTypes.startFrom,
        endAt: discountTypes.endAt,
      })
      .from(storeDiscounts)
      .leftJoin(stores, eq(storeDiscounts.kodeGudang, stores.kodeGudang))
      .leftJoin(discountTypes, eq(storeDiscounts.discountId, discountTypes.discountId));
    return results;
  }

  async getDiscountsByStore(kodeGudang: string): Promise<DiscountType[]> {
    const results = await db
      .select({
        discountId: discountTypes.discountId,
        discountName: discountTypes.discountName,
        discountType: discountTypes.discountType,
        discountAmount: discountTypes.discountAmount,
        startFrom: discountTypes.startFrom,
        endAt: discountTypes.endAt,
      })
      .from(storeDiscounts)
      .innerJoin(discountTypes, eq(storeDiscounts.discountId, discountTypes.discountId))
      .where(eq(storeDiscounts.kodeGudang, kodeGudang));
    return results;
  }

  async assignDiscountToStore(kodeGudang: string, discountId: number): Promise<StoreDiscount> {
    const [result] = await db.insert(storeDiscounts)
      .values({ kodeGudang, discountId })
      .returning();
    return result;
  }

  async removeDiscountFromStore(storeDiscountsId: number): Promise<void> {
    await db.delete(storeDiscounts).where(eq(storeDiscounts.storeDiscountsId, storeDiscountsId));
  }

  // Pricelist operations
  async getPricelist(): Promise<Pricelist[]> {
    return await db.select().from(pricelist);
  }

  async createPricelist(data: InsertPricelist): Promise<Pricelist> {
    const [result] = await db.insert(pricelist).values(data).returning();
    return result;
  }

  async getPriceBySerial(serialNumber: string): Promise<Pricelist | undefined> {
    // Normalize serial number: trim whitespace and convert to uppercase for consistent matching
    const normalizedSerial = serialNumber.trim().toUpperCase();
    const [result] = await db.select().from(pricelist).where(sql`UPPER(TRIM(${pricelist.sn})) = ${normalizedSerial}`);
    return result;
  }

  async getPriceByKodeItem(kodeItem: string): Promise<Pricelist | undefined> {
    const [result] = await db.select().from(pricelist).where(eq(pricelist.kodeItem, kodeItem));
    return result;
  }

  async getPricesByFamilyAndMaterial(family: string, deskripsiMaterial: string): Promise<Pricelist[]> {
    return await db.select().from(pricelist).where(
      and(
        eq(pricelist.family, family),
        eq(pricelist.deskripsiMaterial, deskripsiMaterial)
      )
    );
  }

  private familyCodesCache: string[] | null = null;
  private familyCodesCacheTime: number = 0;
  private readonly FAMILY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private async getCachedFamilyCodes(): Promise<string[]> {
    const now = Date.now();
    if (this.familyCodesCache && (now - this.familyCodesCacheTime) < this.FAMILY_CACHE_TTL) {
      return this.familyCodesCache;
    }
    const results = await db.selectDistinct({ family: pricelist.family })
      .from(pricelist)
      .where(sql`${pricelist.family} IS NOT NULL AND ${pricelist.family} != ''`);
    this.familyCodesCache = results.map(f => f.family!).filter(Boolean);
    this.familyCodesCacheTime = now;
    return this.familyCodesCache;
  }

  // Enhanced price resolution that uses reference_sheet for hierarchical lookup
  async getEnhancedPriceForItem(kodeItem: string, serialNumber?: string): Promise<Pricelist | undefined> {
    // Strategy 1: Try exact serial number match if provided
    if (serialNumber) {
      const serialPrice = await this.getPriceBySerial(serialNumber);
      if (serialPrice && serialPrice.normalPrice) {
        return serialPrice;
      }
    }

    // Strategy 2: Try exact kode_item match
    const itemPrice = await this.getPriceByKodeItem(kodeItem);
    if (itemPrice && itemPrice.normalPrice) {
      return itemPrice;
    }

    // Strategy 3: Get item details from reference_sheet for hierarchical lookup
    const [refItem] = await db.select().from(referenceSheet).where(eq(referenceSheet.kodeItem, kodeItem));
    
    if (refItem) {
      // Strategy 4: Try family + deskripsi_material match (best fit)
      if (refItem.family && refItem.deskripsiMaterial) {
        const [familyMaterialPrice] = await db.select().from(pricelist).where(
          and(
            eq(pricelist.family, refItem.family),
            eq(pricelist.deskripsiMaterial, refItem.deskripsiMaterial),
            sql`${pricelist.normalPrice} IS NOT NULL`
          )
        );
        if (familyMaterialPrice) {
          return familyMaterialPrice;
        }
      }

      // Strategy 5: Try family match
      if (refItem.family) {
        const [familyPrice] = await db.select().from(pricelist).where(
          and(
            eq(pricelist.family, refItem.family),
            sql`${pricelist.normalPrice} IS NOT NULL`
          )
        );
        if (familyPrice) {
          return familyPrice;
        }
      }

      // Strategy 6: Try kelompok match
      if (refItem.kelompok) {
        const [kelompokPrice] = await db.select().from(pricelist).where(
          and(
            eq(pricelist.kelompok, refItem.kelompok),
            sql`${pricelist.normalPrice} IS NOT NULL`
          )
        );
        if (kelompokPrice) {
          return kelompokPrice;
        }
      }
    }

    // Strategy 7: Match kode_item prefix against known family codes (cached)
    const families = await this.getCachedFamilyCodes();
    const upperKode = kodeItem.toUpperCase();
    
    const matchedFamilies = families
      .filter(f => upperKode.startsWith(f.toUpperCase()))
      .sort((a, b) => b.length - a.length); // longest match first
    
    if (matchedFamilies.length > 0) {
      const [familyPrice] = await db.select().from(pricelist).where(
        and(
          sql`${pricelist.family} IN (${sql.join(matchedFamilies.map(f => sql`${f}`), sql`, `)})`,
          sql`${pricelist.normalPrice} IS NOT NULL`
        )
      ).orderBy(sql`LENGTH(${pricelist.family}) DESC`).limit(1);
      
      if (familyPrice) {
        return familyPrice;
      }
    }

    return undefined;
  }

  async updatePricelist(pricelistId: number, data: Partial<InsertPricelist>): Promise<Pricelist> {
    const [result] = await db.update(pricelist)
      .set(data)
      .where(eq(pricelist.pricelistId, pricelistId))
      .returning();
    return result;
  }

  async deletePricelist(pricelistId: number): Promise<void> {
    await db.delete(pricelist).where(eq(pricelist.pricelistId, pricelistId));
  }

  // Sales operations
  async createSale(data: InsertLaporanPenjualan): Promise<LaporanPenjualan> {
    const [result] = await db.insert(laporanPenjualan).values(data).returning();
    return result;
  }

  async getSales(kodeGudang?: string, tanggal?: string): Promise<LaporanPenjualan[]> {
    if (kodeGudang || tanggal) {
      const conditions = [];
      if (kodeGudang) conditions.push(eq(laporanPenjualan.kodeGudang, kodeGudang));
      if (tanggal) conditions.push(eq(laporanPenjualan.tanggal, tanggal));
      return await db.select().from(laporanPenjualan).where(and(...conditions)).orderBy(desc(laporanPenjualan.tanggal));
    }

    return await db.select().from(laporanPenjualan).orderBy(desc(laporanPenjualan.tanggal));
  }

  async getSalesToday(kodeGudang?: string): Promise<{ totalSales: string, count: number }> {
    const today = new Date().toISOString().split('T')[0];
    const conditions = [eq(laporanPenjualan.tanggal, today)];
    if (kodeGudang) {
      conditions.push(eq(laporanPenjualan.kodeGudang, kodeGudang));
    }
    const [result] = await db
      .select({
        totalSales: sql<string>`COALESCE(SUM(${laporanPenjualan.discByAmount}), 0)`,
        count: sql<number>`COUNT(*)`
      })
      .from(laporanPenjualan)
      .where(and(...conditions));
    
    return result || { totalSales: '0', count: 0 };
  }

  async getSaleById(penjualanId: number): Promise<LaporanPenjualan | undefined> {
    const [sale] = await db.select().from(laporanPenjualan).where(eq(laporanPenjualan.penjualanId, penjualanId)).limit(1);
    return sale;
  }

  async updateSale(penjualanId: number, data: Partial<InsertLaporanPenjualan>): Promise<LaporanPenjualan> {
    const [updatedSale] = await db.update(laporanPenjualan)
      .set(data)
      .where(eq(laporanPenjualan.penjualanId, penjualanId))
      .returning();
    
    if (!updatedSale) {
      throw new Error(`Sale with ID ${penjualanId} not found`);
    }
    
    return updatedSale;
  }

  async deleteSale(penjualanId: number): Promise<void> {
    const result = await db.delete(laporanPenjualan).where(eq(laporanPenjualan.penjualanId, penjualanId));
    
    if (result.rowCount === 0) {
      throw new Error(`Sale with ID ${penjualanId} not found`);
    }
  }

  // Settlement operations
  async createSettlement(data: InsertSettlement): Promise<Settlement> {
    const [result] = await db.insert(settlements).values(data).returning();
    return result;
  }

  async getSettlements(kodeGudang?: string, tanggal?: string): Promise<Settlement[]> {
    if (kodeGudang || tanggal) {
      const conditions = [];
      if (kodeGudang) conditions.push(eq(settlements.kodeGudang, kodeGudang));
      if (tanggal) conditions.push(eq(settlements.tanggal, tanggal));
      return await db.select().from(settlements).where(and(...conditions)).orderBy(desc(settlements.tanggal));
    }

    return await db.select().from(settlements).orderBy(desc(settlements.tanggal));
  }

  async getSettlementByStoreAndDate(kodeGudang: string, tanggal: string): Promise<Settlement | undefined> {
    const [result] = await db.select().from(settlements).where(
      and(
        eq(settlements.kodeGudang, kodeGudang),
        eq(settlements.tanggal, tanggal)
      )
    );
    return result;
  }

  async getSettlementByBazarAndDate(bazarId: number, tanggal: string): Promise<Settlement | undefined> {
    const [result] = await db.select().from(settlements).where(
      and(
        eq(settlements.bazarId, bazarId),
        eq(settlements.tanggal, tanggal)
      )
    );
    return result;
  }

  async updateSettlement(id: number, data: Partial<InsertSettlement>): Promise<Settlement> {
    const [result] = await db.update(settlements)
      .set(data)
      .where(eq(settlements.settlementId, id))
      .returning();
    return result;
  }

  async deleteSettlement(id: number): Promise<void> {
    await db.delete(settlements).where(eq(settlements.settlementId, id));
  }

  async deleteEdcSettlementsBySettlementId(settlementId: number): Promise<void> {
    await db.delete(edcSettlement).where(eq(edcSettlement.settlementId, settlementId));
  }

  
  // Stock Opname operations
  async getStockOpname(): Promise<StockOpname[]> {
    return await db.select().from(stockOpname).orderBy(desc(stockOpname.tanggal));
  }
  
  async createStockOpname(data: InsertStockOpname): Promise<StockOpname> {
    const [result] = await db.insert(stockOpname).values(data).returning();
    return result;
  }
  
  async createSoItemList(data: InsertSoItemList): Promise<SoItemList> {
    const [result] = await db.insert(soItemList).values(data).returning();
    return result;
  }
  
  async getSoItemListByStockOpnameId(soId: number): Promise<SoItemList[]> {
    return await db.select().from(soItemList).where(eq(soItemList.soId, soId));
  }

  // Transfer operations
  async createTransferOrder(data: InsertTransferOrder): Promise<TransferOrder> {
    const [result] = await db.insert(transferOrders).values(data).returning();
    return result;
  }

  async getTransferOrders(): Promise<TransferOrder[]> {
    return await db.select().from(transferOrders).orderBy(desc(transferOrders.tanggal));
  }

  // EDC operations
  async getEdc(): Promise<Edc[]> {
    return await db.select().from(edc);
  }
  
  async createEdc(data: InsertEdc): Promise<Edc> {
    const [result] = await db.insert(edc).values(data).returning();
    return result;
  }

  async updateEdc(edcId: number, data: Partial<InsertEdc>): Promise<Edc> {
    const [result] = await db.update(edc)
      .set(data)
      .where(eq(edc.edcId, edcId))
      .returning();
    return result;
  }

  async deleteEdc(edcId: number): Promise<void> {
    await db.delete(edc).where(eq(edc.edcId, edcId));
  }
  
  async getStoreEdc(): Promise<StoreEdc[]> {
    return await db.select().from(storeEdc);
  }
  
  async createStoreEdc(data: InsertStoreEdc): Promise<StoreEdc> {
    const [result] = await db.insert(storeEdc).values(data).returning();
    return result;
  }

  async getStoreEdcByStore(kodeGudang: string): Promise<StoreEdc[]> {
    return await db.select().from(storeEdc).where(eq(storeEdc.kodeGudang, kodeGudang));
  }

  async deleteStoreEdc(storeEdcId: number): Promise<void> {
    await db.delete(storeEdc).where(eq(storeEdc.storeEdcId, storeEdcId));
  }
  
  async createEdcSettlement(data: InsertEdcSettlement): Promise<EdcSettlement> {
    const [result] = await db.insert(edcSettlement).values(data).returning();
    return result;
  }

  async getEdcSettlementsBySettlementIds(settlementIds: number[]): Promise<EdcSettlement[]> {
    if (settlementIds.length === 0) return [];
    return await db.select().from(edcSettlement).where(inArray(edcSettlement.settlementId, settlementIds));
  }

  // Staff operations
  async getStaff(): Promise<Staff[]> {
    return await db.select().from(staff);
  }
  
  async createStaff(data: InsertStaff): Promise<Staff> {
    const [result] = await db.insert(staff).values(data).returning();
    return result;
  }

  async updateStaff(nik: string, data: Partial<InsertStaff>): Promise<Staff> {
    const [result] = await db.update(staff)
      .set(data)
      .where(eq(staff.nik, nik))
      .returning();
    return result;
  }

  async deleteStaff(nik: string): Promise<void> {
    await db.delete(staff).where(eq(staff.nik, nik));
  }

  // Bulk operations for better performance
  async bulkInsertStaff(data: InsertStaff[]): Promise<void> {
    const batchSize = 25; // Process in smaller chunks
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      await db.insert(staff).values(batch).onConflictDoUpdate({
        target: staff.nik,
        set: {
          email: sql.raw('excluded.email'),
          password: sql.raw('excluded.password'),
          namaLengkap: sql.raw('excluded.nama_lengkap'),
          kota: sql.raw('excluded.kota'),
          alamat: sql.raw('excluded.alamat'),
          noHp: sql.raw('excluded.no_hp'),
          tempatLahir: sql.raw('excluded.tempat_lahir'),
          tanggalLahir: sql.raw('excluded.tanggal_lahir'),
          tanggalMasuk: sql.raw('excluded.tanggal_masuk'),
          jabatan: sql.raw('excluded.jabatan'),
        }
      });
    }
  }

  // Search functionality
  async searchStaff(query: string): Promise<Staff[]> {
    return await db.select().from(staff)
      .where(
        or(
          ilike(staff.nik, `%${query}%`),
          ilike(staff.namaLengkap, `%${query}%`),
          ilike(staff.email, `%${query}%`),
          ilike(staff.jabatan, `%${query}%`)
        )
      )
      .limit(100);
  }

  async searchStores(query: string): Promise<Store[]> {
    return await db.select().from(stores)
      .where(
        or(
          ilike(stores.kodeGudang, `%${query}%`),
          ilike(stores.namaGudang, `%${query}%`)
        )
      )
      .limit(100);
  }

  async getStaffByNik(nik: string): Promise<Staff | undefined> {
    const [result] = await db.select().from(staff).where(eq(staff.nik, nik));
    return result;
  }

  async getStaffByEmail(email: string): Promise<Staff | undefined> {
    const [result] = await db.select().from(staff).where(eq(staff.email, email));
    return result;
  }

  // Position operations
  async getPositions(): Promise<Position[]> {
    return await db.select().from(positions);
  }

  async createPosition(data: InsertPosition): Promise<Position> {
    const [result] = await db.insert(positions).values(data).returning();
    return result;
  }

  async updatePosition(positionId: number, data: Partial<InsertPosition>): Promise<Position> {
    const [result] = await db.update(positions)
      .set(data)
      .where(eq(positions.positionId, positionId))
      .returning();
    return result;
  }

  async deletePosition(positionId: number): Promise<void> {
    await db.delete(positions).where(eq(positions.positionId, positionId));
  }

  async getPositionByName(positionName: string): Promise<Position | undefined> {
    const [result] = await db.select().from(positions).where(eq(positions.positionName, positionName));
    return result;
  }

  async getUserPermissions(userEmail: string): Promise<Position | null> {
    // Optimized single query with JOIN to avoid N+1 problem
    const result = await db
      .select({
        positionId: positions.positionId,
        positionName: positions.positionName,
        description: positions.description,
        canAccessDashboard: positions.canAccessDashboard,
        canAccessSalesEntry: positions.canAccessSalesEntry,
        canAccessSettlements: positions.canAccessSettlements,
        canAccessStockDashboard: positions.canAccessStockDashboard,
        canAccessStockOpname: positions.canAccessStockOpname,
        canAccessTransfers: positions.canAccessTransfers,
        canAccessPriceLists: positions.canAccessPriceLists,
        canAccessDiscounts: positions.canAccessDiscounts,
        canAccessAdminSettings: positions.canAccessAdminSettings,
        staffJabatan: staff.jabatan,
      })
      .from(staff)
      .leftJoin(positions, eq(staff.jabatan, positions.positionName))
      .where(eq(staff.email, userEmail))
      .limit(1);
    
    if (result.length === 0) {
      // Default permissions for users without staff record
      return {
        positionId: 0,
        positionName: 'User',
        description: 'Basic user',
        canAccessDashboard: true,
        canAccessSalesEntry: false,
        canAccessSettlements: false,
        canAccessStockDashboard: false,
        canAccessStockOpname: false,
        canAccessTransfers: false,
        canAccessPriceLists: false,
        canAccessDiscounts: false,
        canAccessAdminSettings: false,
      };
    }
    
    const user = result[0];
    
    if (!user.positionId || !user.staffJabatan) {
      // Default permissions if position not found
      return {
        positionId: 0,
        positionName: user.staffJabatan || 'User',
        description: 'Unknown position',
        canAccessDashboard: true,
        canAccessSalesEntry: false,
        canAccessSettlements: false,
        canAccessStockDashboard: false,
        canAccessStockOpname: false,
        canAccessTransfers: false,
        canAccessPriceLists: false,
        canAccessDiscounts: false,
        canAccessAdminSettings: false,
      };
    }
    
    return {
      positionId: user.positionId,
      positionName: user.positionName,
      description: user.description,
      canAccessDashboard: user.canAccessDashboard,
      canAccessSalesEntry: user.canAccessSalesEntry,
      canAccessSettlements: user.canAccessSettlements,
      canAccessStockDashboard: user.canAccessStockDashboard,
      canAccessStockOpname: user.canAccessStockOpname,
      canAccessTransfers: user.canAccessTransfers,
      canAccessPriceLists: user.canAccessPriceLists,
      canAccessDiscounts: user.canAccessDiscounts,
      canAccessAdminSettings: user.canAccessAdminSettings,
    };
  }
  
  // Transfer order item list operations
  async createToItemList(data: InsertToItemList): Promise<ToItemList> {
    const [result] = await db.insert(toItemList).values(data).returning();
    return result;
  }
  
  async getToItemListByTransferOrderNumber(toNumber: string): Promise<ToItemList[]> {
    return await db.select().from(toItemList).where(eq(toItemList.toNumber, toNumber));
  }

  async deleteTransferItem(toItemListId: number, toNumber: string): Promise<void> {
    await db.delete(toItemList)
      .where(and(
        eq(toItemList.toItemListId, toItemListId),
        eq(toItemList.toNumber, toNumber)
      ));
  }

  async updateTransferOrder(toNumber: string, data: Partial<InsertTransferOrder>): Promise<TransferOrder> {
    const [updatedTransfer] = await db
      .update(transferOrders)
      .set(data)
      .where(eq(transferOrders.toNumber, toNumber))
      .returning();
    return updatedTransfer;
  }

  async updateTransferItem(toItemListId: number, data: Partial<InsertToItemList>): Promise<ToItemList> {
    const [updatedItem] = await db
      .update(toItemList)
      .set(data)
      .where(eq(toItemList.toItemListId, toItemListId))
      .returning();
    return updatedItem;
  }

  async deleteAllTransferItems(toNumber: string): Promise<void> {
    await db.delete(toItemList).where(eq(toItemList.toNumber, toNumber));
  }

  async deleteTransferOrder(toNumber: string): Promise<void> {
    await db.delete(transferOrders).where(eq(transferOrders.toNumber, toNumber));
  }

  // Inventory search operations - searches actual store stock from transfer orders AND stock table
  async searchInventoryBySerial(storeCode: string, serialNumber: string): Promise<any[]> {
    // Normalize serial number: trim whitespace and convert to uppercase for consistent matching
    const normalizedSerial = serialNumber.trim().toUpperCase();
    
    // Search in Virtual Store Inventory - this is the source of truth for available stock
    const inventoryResults = await db
      .select({
        kodeItem: virtualStoreInventory.kodeItem,
        namaBarang: virtualStoreInventory.namaBarang,
        sn: virtualStoreInventory.sn,
        qty: virtualStoreInventory.qty,
        kodeGudang: virtualStoreInventory.kodeGudang,
      })
      .from(virtualStoreInventory)
      .where(
        and(
          sql`UPPER(TRIM(${virtualStoreInventory.sn})) = ${normalizedSerial}`,
          gt(virtualStoreInventory.qty, 0), // Only items with available quantity
          storeCode === 'ALL_STORE' ? sql`1=1` : eq(virtualStoreInventory.kodeGudang, storeCode)
        )
      );

    // Use enhanced price resolution for each item
    const enhancedResults = await Promise.all(inventoryResults.map(async (item) => {
      const priceInfo = item.kodeItem ? await this.getEnhancedPriceForItem(item.kodeItem, item.sn || undefined) : null;
      
      // Get item name from reference sheet if not available
      let itemName = item.namaBarang;
      if (!itemName && item.kodeItem) {
        const refItem = await this.getReferenceSheetByKodeItem(item.kodeItem);
        itemName = refItem?.namaItem || null;
      }
      
      return {
        kodeItem: item.kodeItem,
        namaItem: itemName,
        normalPrice: priceInfo?.normalPrice ? Number(priceInfo.normalPrice) : 0,
        sp: priceInfo?.sp ? Number(priceInfo.sp) : null,
        availableQuantity: item.qty,
        kelompok: priceInfo?.kelompok || null,
        family: priceInfo?.family || null,
        serialNumber: item.sn,
        // Calculate sp discount percentage if sp exists and is less than normal price
        spDiscountPercentage: (priceInfo?.sp && priceInfo?.normalPrice && Number(priceInfo.sp) < Number(priceInfo.normalPrice)) 
          ? Math.round(((Number(priceInfo.normalPrice) - Number(priceInfo.sp)) / Number(priceInfo.normalPrice)) * 100) 
          : null,
      };
    }));

    return enhancedResults;
  }

  async searchInventoryByDetails(storeCode: string, searchQuery: string): Promise<any[]> {
    // Search in Virtual Store Inventory joined with reference_sheet for better matching
    // Item code pattern: material code + kode motif
    const results = await db
      .select({
        kodeItem: virtualStoreInventory.kodeItem,
        namaBarang: virtualStoreInventory.namaBarang,
        sn: virtualStoreInventory.sn,
        qty: virtualStoreInventory.qty,
        kodeGudang: virtualStoreInventory.kodeGudang,
        refNamaItem: referenceSheet.namaItem,
        kelompok: referenceSheet.kelompok,
        family: referenceSheet.family,
        kodeMotif: referenceSheet.kodeMotif,
        deskripsiMaterial: referenceSheet.deskripsiMaterial,
      })
      .from(virtualStoreInventory)
      .leftJoin(referenceSheet, eq(virtualStoreInventory.kodeItem, referenceSheet.kodeItem))
      .where(
        and(
          or(
            ilike(virtualStoreInventory.kodeItem, `%${searchQuery}%`),
            ilike(virtualStoreInventory.namaBarang, `%${searchQuery}%`),
            ilike(virtualStoreInventory.sn, `%${searchQuery}%`),
            ilike(referenceSheet.namaItem, `%${searchQuery}%`),
            ilike(referenceSheet.kelompok, `%${searchQuery}%`),
            ilike(referenceSheet.family, `%${searchQuery}%`),
            ilike(referenceSheet.kodeMotif, `%${searchQuery}%`),
            ilike(referenceSheet.deskripsiMaterial, `%${searchQuery}%`)
          ),
          gt(virtualStoreInventory.qty, 0), // Only items with available quantity
          storeCode === 'ALL_STORE' ? sql`1=1` : eq(virtualStoreInventory.kodeGudang, storeCode)
        )
      )
      .limit(50); // Limit results for performance

    // Use enhanced price resolution for each item
    const enhancedResults = await Promise.all(results.map(async (item) => {
      const priceInfo = item.kodeItem ? await this.getEnhancedPriceForItem(item.kodeItem, item.sn || undefined) : null;
      
      // Use reference sheet name if virtual inventory doesn't have it
      const itemName = item.namaBarang || item.refNamaItem;
      
      return {
        kodeItem: item.kodeItem,
        namaItem: itemName,
        normalPrice: priceInfo?.normalPrice ? Number(priceInfo.normalPrice) : 0,
        sp: priceInfo?.sp ? Number(priceInfo.sp) : null,
        availableQuantity: item.qty,
        kelompok: priceInfo?.kelompok || item.kelompok || null,
        family: priceInfo?.family || item.family || null,
        serialNumber: item.sn,
        kodeMotif: item.kodeMotif,
        deskripsiMaterial: item.deskripsiMaterial,
        // Calculate sp discount percentage if sp exists and is less than normal price
        spDiscountPercentage: (priceInfo?.sp && priceInfo?.normalPrice && Number(priceInfo.sp) < Number(priceInfo.normalPrice)) 
          ? Math.round(((Number(priceInfo.normalPrice) - Number(priceInfo.sp)) / Number(priceInfo.normalPrice)) * 100) 
          : null,
      };
    }));

    return enhancedResults;
  }

  // Stock operations for new stock table
  async getStockOnHand(kodeGudang?: string): Promise<Array<{
    stockId: number;
    kodeGudang: string;
    serialNumber: string;
    kodeItem: string;
    qty: number;
    tanggalIn: string | null;
  }>> {
    // Only get stock items that haven't been sold (tanggalOut is NULL)
    const stockItems = await db
      .select({
        stockId: stock.stockId,
        kodeGudang: stock.kodeGudang,
        serialNumber: stock.serialNumber,
        kodeItem: stock.kodeItem,
        qty: stock.qty,
        tanggalIn: stock.tanggalIn,
      })
      .from(stock)
      .where(
        and(
          sql`${stock.tanggalOut} IS NULL`, // Only show available stock
          kodeGudang && kodeGudang !== 'ALL_STORE' ? eq(stock.kodeGudang, kodeGudang) : sql`1=1`
        )
      )
      .orderBy(stock.kodeItem, stock.serialNumber);

    return stockItems;
  }

  // Get stock items without pricing using full 6-level business logic
  async getStockWithoutPricing(kodeGudang?: string): Promise<Array<{
    stockId: number;
    kodeGudang: string;
    serialNumber: string;
    kodeItem: string;
    qty: number;
    tanggalIn: string | null;
  }>> {
    // First get all available stock items
    const allStockItems = await db
      .select({
        stockId: stock.stockId,
        kodeGudang: stock.kodeGudang,
        serialNumber: stock.serialNumber,
        kodeItem: stock.kodeItem,
        qty: stock.qty,
        tanggalIn: stock.tanggalIn,
      })
      .from(stock)
      .where(
        and(
          sql`${stock.tanggalOut} IS NULL`, // Only show available stock
          kodeGudang && kodeGudang !== 'ALL_STORE' ? eq(stock.kodeGudang, kodeGudang) : sql`1=1`
        )
      )
      .orderBy(stock.kodeItem, stock.serialNumber);

    // Apply enhanced pricing business logic to filter items without pricing
    const itemsWithoutPricing = [];
    for (const item of allStockItems) {
      // Use the full 6-level pricing hierarchy
      const priceInfo = await this.getEnhancedPriceForItem(item.kodeItem, item.serialNumber);
      
      // If no pricing found through any of the 6 strategies, include in results
      if (!priceInfo || !priceInfo.normalPrice) {
        itemsWithoutPricing.push(item);
      }
    }

    return itemsWithoutPricing;
  }

  // Get items sold today
  async getStockSoldToday(kodeGudang?: string): Promise<Array<{
    kodeItem: string;
    serialNumber: string;
    qty: number;
    tanggalOut: string | null;
  }>> {
    const today = new Date().toISOString().split('T')[0];
    
    const soldItems = await db
      .select({
        kodeItem: stock.kodeItem,
        serialNumber: stock.serialNumber,
        qty: stock.qty,
        tanggalOut: stock.tanggalOut,
      })
      .from(stock)
      .where(
        and(
          sql`DATE(${stock.tanggalOut}) = ${today}`,
          kodeGudang && kodeGudang !== 'ALL_STORE' ? eq(stock.kodeGudang, kodeGudang) : sql`1=1`
        )
      )
      .orderBy(stock.tanggalOut);

    return soldItems;
  }

  // Get low stock items (qty < 10 and still in stock)
  async getLowStockItems(kodeGudang?: string): Promise<Array<{
    stockId: number;
    kodeGudang: string;
    serialNumber: string;
    kodeItem: string;
    qty: number;
    tanggalIn: string | null;
  }>> {
    const lowStockItems = await db
      .select({
        stockId: stock.stockId,
        kodeGudang: stock.kodeGudang,
        serialNumber: stock.serialNumber,
        kodeItem: stock.kodeItem,
        qty: stock.qty,
        tanggalIn: stock.tanggalIn,
      })
      .from(stock)
      .where(
        and(
          sql`${stock.tanggalOut} IS NULL`, // Only show available stock
          sql`${stock.qty} < 10`, // Low stock threshold
          sql`${stock.qty} > 0`, // But not out of stock
          kodeGudang && kodeGudang !== 'ALL_STORE' ? eq(stock.kodeGudang, kodeGudang) : sql`1=1`
        )
      )
      .orderBy(stock.qty, stock.kodeItem);

    return lowStockItems;
  }

  // Get inbound stock (pending transfers to this store)
  async getInboundStock(kodeGudang?: string): Promise<Array<{
    toNumber: string;
    kodeItem: string;
    namaItem: string | null;
    qty: number;
    fromStore: string;
    tanggal: string | null;
  }>> {
    // Get transfers that haven't been processed to stock yet
    const inboundItems = await db
      .select({
        toNumber: toItemList.toNumber,
        kodeItem: sql<string>`COALESCE(${toItemList.kodeItem}, '')`,
        namaItem: toItemList.namaItem,
        qty: sql<number>`COALESCE(${toItemList.qty}, 1)`,
        fromStore: sql<string>`COALESCE(${transferOrders.dariGudang}, '')`,
        tanggal: transferOrders.tanggal,
      })
      .from(toItemList)
      .innerJoin(transferOrders, eq(toItemList.toNumber, transferOrders.toNumber))
      .leftJoin(stock, and(
        eq(stock.serialNumber, toItemList.toNumber),
        eq(stock.kodeItem, toItemList.kodeItem)
      ))
      .where(
        and(
          kodeGudang && kodeGudang !== 'ALL_STORE' ? 
            eq(transferOrders.keGudang, kodeGudang) : 
            sql`1=1`,
          sql`${stock.stockId} IS NULL` // Transfer not yet processed to stock
        )
      )
      .orderBy(transferOrders.tanggal);

    return inboundItems;
  }

  async getStockOverview(storeId?: string, limitItems: number = 10) {
    // Get all stores on-hand totals (where tanggal_out IS NULL)
    const storesOnHand = await db
      .select({
        kodeGudang: stock.kodeGudang,
        onHand: sql<number>`SUM(${stock.qty})`.as('onHand')
      })
      .from(stock)
      .where(sql`${stock.tanggalOut} IS NULL`)
      .groupBy(stock.kodeGudang);

    let activeStoreDetails = null;
    if (storeId) {
      // Get top items for the active store
      const topItems = await db
        .select({
          kodeItem: stock.kodeItem,
          qtyOnHand: sql<number>`SUM(${stock.qty})`.as('qtyOnHand')
        })
        .from(stock)
        .where(
          and(
            eq(stock.kodeGudang, storeId),
            sql`${stock.tanggalOut} IS NULL`
          )
        )
        .groupBy(stock.kodeItem)
        .orderBy(sql`SUM(${stock.qty}) DESC`)
        .limit(limitItems);

      const storeOnHand = storesOnHand.find(s => s.kodeGudang === storeId);
      
      activeStoreDetails = {
        kodeGudang: storeId,
        onHand: storeOnHand?.onHand || 0,
        topItems
      };
    }

    return {
      stores: storesOnHand,
      activeStore: activeStoreDetails
    };
  }

  async getStockMovements(storeId?: string, from?: string, to?: string) {
    const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = to || new Date().toISOString().split('T')[0];
    
    // Get IN movements (based on tanggal_in)
    const inMovements = await db
      .select({
        date: sql<string>`${stock.tanggalIn}`.as('date'),
        count: sql<number>`COUNT(*)`.as('count')
      })
      .from(stock)
      .where(
        and(
          storeId ? eq(stock.kodeGudang, storeId) : sql`1=1`,
          sql`${stock.tanggalIn} BETWEEN ${fromDate} AND ${toDate}`
        )
      )
      .groupBy(stock.tanggalIn)
      .orderBy(stock.tanggalIn);

    // Get OUT movements (based on tanggal_out)
    const outMovements = await db
      .select({
        date: sql<string>`${stock.tanggalOut}`.as('date'),
        count: sql<number>`COUNT(*)`.as('count')
      })
      .from(stock)
      .where(
        and(
          storeId ? eq(stock.kodeGudang, storeId) : sql`1=1`,
          sql`${stock.tanggalOut} IS NOT NULL`,
          sql`${stock.tanggalOut} BETWEEN ${fromDate} AND ${toDate}`
        )
      )
      .groupBy(stock.tanggalOut)
      .orderBy(stock.tanggalOut);

    return {
      range: { from: fromDate, to: toDate },
      storeId,
      in: inMovements,
      out: outMovements
    };
  }

  async updateStockOnSale(serialNumber: string, kodeGudang: string, saleDate: string): Promise<boolean> {
    try {
      console.log(`📦 Updating stock on sale: ${serialNumber} at ${kodeGudang} on ${saleDate}`);
      
      // First, try to find the stock record with exact serial number match
      let stockRecord = await db
        .select()
        .from(stock)
        .where(
          and(
            eq(stock.serialNumber, serialNumber),
            eq(stock.kodeGudang, kodeGudang),
            sql`${stock.tanggalOut} IS NULL` // Item is still in stock
          )
        )
        .limit(1);

      // If not found, try to find by synthetic serial number pattern
      // This handles cases where the sale uses a transfer order number instead of the actual serial
      if (stockRecord.length === 0 && serialNumber.includes('-')) {
        // Try to find by synthetic serial pattern (e.g., '2509-249-L1')
        stockRecord = await db
          .select()
          .from(stock)
          .where(
            and(
              sql`${stock.serialNumber} LIKE ${serialNumber + '%'}`,
              eq(stock.kodeGudang, kodeGudang),
              sql`${stock.tanggalOut} IS NULL`
            )
          )
          .limit(1);
      }

      // If still not found, try to find any item with matching kode_item in the store
      // This is a fallback for cases where serial numbers don't match exactly
      if (stockRecord.length === 0) {
        // Get the kode_item from the sale or transfer
        const itemQuery = await db
          .select({ kodeItem: stock.kodeItem })
          .from(stock)
          .where(
            or(
              eq(stock.serialNumber, serialNumber),
              sql`${stock.serialNumber} LIKE ${serialNumber + '%'}`
            )
          )
          .limit(1);
          
        if (itemQuery.length > 0) {
          // Find any available stock with same item code in the store
          stockRecord = await db
            .select()
            .from(stock)
            .where(
              and(
                eq(stock.kodeItem, itemQuery[0].kodeItem),
                eq(stock.kodeGudang, kodeGudang),
                sql`${stock.tanggalOut} IS NULL`
              )
            )
            .limit(1);
        }
      }

      if (stockRecord.length === 0) {
        console.warn(`⚠️ No stock record found for sale: ${serialNumber} at ${kodeGudang}`);
        return false;
      }

      // Update the stock record to mark as sold
      const actualSerialNumber = stockRecord[0].serialNumber;
      console.log(`✅ Found stock record with serial: ${actualSerialNumber}`);
      
      const result = await db
        .update(stock)
        .set({ tanggalOut: saleDate })
        .where(
          and(
            eq(stock.serialNumber, actualSerialNumber),
            eq(stock.kodeGudang, kodeGudang),
            sql`${stock.tanggalOut} IS NULL`
          )
        );

      console.log(`✅ Stock updated for sale: ${serialNumber} at ${kodeGudang}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to update stock for sale ${serialNumber} at ${kodeGudang}:`, error);
      return false;
    }
  }

  // Process transfer into stock movements (IN/OUT records)
  async getUnprocessedTransfers(): Promise<{ toNumber: string; tanggal: string | null; dariGudang: string; keGudang: string; itemCount: number }[]> {
    const result = await db.execute(sql`
      WITH transfer_summary AS (
        SELECT 
          t.to_number,
          t.tanggal,
          t.dari_gudang,
          t.ke_gudang,
          COUNT(til.to_itemlist_id) as item_count
        FROM transfer_order t
        LEFT JOIN to_itemlist til ON t.to_number = til.to_number
        GROUP BY t.to_number, t.tanggal, t.dari_gudang, t.ke_gudang
      )
      SELECT 
        ts.to_number as "toNumber",
        ts.tanggal,
        ts.dari_gudang as "dariGudang",
        ts.ke_gudang as "keGudang",
        ts.item_count as "itemCount"
      FROM transfer_summary ts
      WHERE NOT EXISTS (
        SELECT 1 FROM stock 
        WHERE serial_number LIKE ts.to_number || '-%'
      )
      ORDER BY ts.tanggal DESC
    `);
    
    return result.rows as any[];
  }

  async batchProcessTransfersToStock(): Promise<{ totalProcessed: number; successfulTransfers: string[]; failedTransfers: { toNumber: string; error: string }[]; totalItems: number }> {
    console.log('🚀 Starting batch processing of unprocessed transfers...');
    
    const unprocessedTransfers = await this.getUnprocessedTransfers();
    console.log(`📋 Found ${unprocessedTransfers.length} unprocessed transfers`);
    
    if (unprocessedTransfers.length === 0) {
      return {
        totalProcessed: 0,
        successfulTransfers: [],
        failedTransfers: [],
        totalItems: 0
      };
    }
    
    const successfulTransfers: string[] = [];
    const failedTransfers: { toNumber: string; error: string }[] = [];
    let totalItems = 0;
    
    for (const transfer of unprocessedTransfers) {
      try {
        console.log(`\n📦 Processing transfer ${transfer.toNumber} (${transfer.itemCount} items)...`);
        const result = await this.processTransferToStock(transfer.toNumber);
        
        if (result.processed > 0) {
          successfulTransfers.push(transfer.toNumber);
          totalItems += result.processed;
          console.log(`✅ Successfully processed ${result.processed} items from transfer ${transfer.toNumber}`);
        } else if (result.errors.length > 0 && result.errors[0].includes('already been processed')) {
          console.log(`⏭️ Transfer ${transfer.toNumber} was already processed, skipping`);
        } else {
          failedTransfers.push({
            toNumber: transfer.toNumber,
            error: result.errors.join(', ')
          });
          console.log(`❌ Failed to process transfer ${transfer.toNumber}: ${result.errors.join(', ')}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failedTransfers.push({
          toNumber: transfer.toNumber,
          error: errorMessage
        });
        console.error(`❌ Error processing transfer ${transfer.toNumber}:`, error);
      }
    }
    
    console.log(`\n🎉 Batch processing complete:`);
    console.log(`   ✅ Successful transfers: ${successfulTransfers.length}`);
    console.log(`   ❌ Failed transfers: ${failedTransfers.length}`);
    console.log(`   📦 Total items processed: ${totalItems}`);
    
    return {
      totalProcessed: successfulTransfers.length,
      successfulTransfers,
      failedTransfers,
      totalItems
    };
  }

  async processTransferToStock(toNumber: string): Promise<{ processed: number; errors: string[] }> {
    try {
      // Check if transfer has already been processed (idempotency protection)
      // Check for both synthetic serial numbers AND real serial numbers from transfer items
      const transferItems = await db
        .select({ sn: toItemList.sn })
        .from(toItemList)
        .where(eq(toItemList.toNumber, toNumber))
        .limit(1);
        
      if (transferItems.length > 0) {
        // Check if any stock record exists from this transfer
        const existingStockRecords = await db
          .select()
          .from(stock)
          .where(
            or(
              // Check for synthetic serial numbers
              sql`${stock.serialNumber} LIKE ${toNumber + '-%'}`,
              // Check for real serial numbers from this transfer
              transferItems[0].sn ? eq(stock.serialNumber, transferItems[0].sn) : sql`false`
            )
          )
          .limit(1);
          
        if (existingStockRecords.length > 0) {
          console.log(`⚠️ Transfer ${toNumber} has already been processed - skipping`);
          return {
            processed: 0,
            errors: [`Transfer ${toNumber} has already been processed`]
          };
        }
      }

      // Get transfer details
      const transferOrder = await db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.toNumber, toNumber))
        .limit(1);
      
      if (transferOrder.length === 0) {
        throw new Error(`Transfer ${toNumber} not found`);
      }

      const transfer = transferOrder[0];
      console.log(`🔄 Processing transfer ${toNumber}: ${transfer.dariGudang} → ${transfer.keGudang}`);

      // Get transfer items
      const transferItemsToProcess = await db
        .select()
        .from(toItemList)
        .where(eq(toItemList.toNumber, toNumber));

      if (transferItemsToProcess.length === 0) {
        throw new Error(`No items found for transfer ${toNumber}`);
      }

      console.log(`📦 Found ${transferItemsToProcess.length} items to process`);

      const stockRecords = [];
      const errors = [];
      const transferDate = transfer.tanggal || new Date().toISOString().split('T')[0];

      for (const item of transferItemsToProcess) {
        try {
          // Get quantity for this line item (default to 1 if not specified)
          const quantity = item.qty || 1;
          
          // Ensure we have valid warehouse codes
          if (!transfer.dariGudang || !transfer.keGudang) {
            throw new Error(`Invalid warehouse codes: ${transfer.dariGudang} -> ${transfer.keGudang}`);
          }

          // Create individual stock records for each quantity unit
          for (let qtyIndex = 1; qtyIndex <= quantity; qtyIndex++) {
            // Always copy serial number exactly from to_itemlist, no synthetic generation
            const serialNumber = item.sn || '-';

            // Create stock OUT record for source store (item leaves source store)
            stockRecords.push({
              kodeGudang: transfer.dariGudang,
              serialNumber: serialNumber,
              kodeItem: item.kodeItem || 'UNKNOWN',
              qty: 1, // Always 1 for individual item record
              tanggalIn: transferDate, // When it originally came into source store
              tanggalOut: transferDate, // When it left source store (today)
            });

            // Create stock IN record for destination store (item arrives at destination)
            stockRecords.push({
              kodeGudang: transfer.keGudang,
              serialNumber: serialNumber,
              kodeItem: item.kodeItem || 'UNKNOWN',
              qty: 1, // Always 1 for individual item record
              tanggalIn: transferDate, // When it arrived at destination store (today)
              tanggalOut: undefined, // Still in stock at destination
            });
          }

          console.log(`✅ Prepared stock movements for item: ${item.kodeItem} (qty: ${quantity}, SNs: ${toNumber}-L${item.lineNo || 1}-1 to ${toNumber}-L${item.lineNo || 1}-${quantity})`);
        } catch (itemError) {
          const errorMsg = `Failed to process item ${item.kodeItem}: ${itemError}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // Bulk insert stock records
      if (stockRecords.length > 0) {
        console.log(`💾 Inserting ${stockRecords.length} stock records...`);
        await db.insert(stock).values(stockRecords);
        console.log(`✅ Successfully inserted ${stockRecords.length} stock records`);
      }

      const processed = stockRecords.length / 2; // Divide by 2 because each item creates 2 records (IN + OUT)
      console.log(`🎉 Transfer ${toNumber} processed: ${processed} items, ${errors.length} errors`);

      return {
        processed,
        errors
      };

    } catch (error) {
      console.error(`❌ Failed to process transfer ${toNumber}:`, error);
      throw error;
    }
  }

  // Missing price operations
  async getItemsWithMissingPrices(): Promise<Array<{
    kodeItem: string;
    namaItem: string | null;
    family: string | null;
    deskripsiMaterial: string | null;
    issue: 'no_pricelist' | 'zero_price' | 'null_price';
  }>> {
    try {
      // Query to find reference sheet items with missing or zero prices
      const itemsWithIssues = await db
        .select({
          kodeItem: referenceSheet.kodeItem,
          namaItem: referenceSheet.namaItem,
          family: referenceSheet.family,
          deskripsiMaterial: referenceSheet.deskripsiMaterial,
          normalPrice: pricelist.normalPrice,
          sp: pricelist.sp,
          pricelistId: pricelist.pricelistId,
        })
        .from(referenceSheet)
        .leftJoin(pricelist, 
          or(
            eq(referenceSheet.kodeItem, pricelist.kodeItem),
            and(
              eq(referenceSheet.family, pricelist.family),
              eq(referenceSheet.deskripsiMaterial, pricelist.deskripsiMaterial)
            )
          )
        );

      const missingPriceItems = itemsWithIssues
        .map(item => {
          // Check for missing pricelist entry
          if (!item.pricelistId) {
            return {
              kodeItem: item.kodeItem,
              namaItem: item.namaItem,
              family: item.family,
              deskripsiMaterial: item.deskripsiMaterial,
              issue: 'no_pricelist' as const
            };
          }

          // Check for zero prices
          const normalPrice = parseFloat(item.normalPrice?.toString() || '0');
          const sp = parseFloat(item.sp?.toString() || '0');
          
          if (normalPrice === 0 && sp === 0) {
            return {
              kodeItem: item.kodeItem,
              namaItem: item.namaItem,
              family: item.family,
              deskripsiMaterial: item.deskripsiMaterial,
              issue: 'zero_price' as const
            };
          }

          // Check for null prices
          if (!item.normalPrice && !item.sp) {
            return {
              kodeItem: item.kodeItem,
              namaItem: item.namaItem,
              family: item.family,
              deskripsiMaterial: item.deskripsiMaterial,
              issue: 'null_price' as const
            };
          }

          return null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      // Remove duplicates by kodeItem (keep first occurrence)
      const uniqueItems = missingPriceItems.reduce((acc, current) => {
        const exists = acc.find(item => item.kodeItem === current.kodeItem);
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, [] as typeof missingPriceItems);

      console.log(`📊 Found ${uniqueItems.length} items with pricing issues`);
      return uniqueItems;
      
    } catch (error) {
      console.error('❌ Failed to get items with missing prices:', error);
      throw error;
    }
  }

  // Virtual Store Inventory operations
  async getVirtualStoreInventory(kodeGudang?: string): Promise<VirtualStoreInventory[]> {
    if (kodeGudang) {
      return await db.select().from(virtualStoreInventory)
        .where(eq(virtualStoreInventory.kodeGudang, kodeGudang))
        .orderBy(desc(virtualStoreInventory.createdAt));
    }
    return await db.select().from(virtualStoreInventory)
      .orderBy(desc(virtualStoreInventory.createdAt));
  }

  async getVirtualStoreInventoryBySn(kodeGudang: string, sn: string): Promise<VirtualStoreInventory | undefined> {
    const [item] = await db.select().from(virtualStoreInventory)
      .where(and(
        eq(virtualStoreInventory.kodeGudang, kodeGudang),
        eq(virtualStoreInventory.sn, sn)
      ));
    return item;
  }

  async createVirtualStoreInventory(data: InsertVirtualStoreInventory): Promise<VirtualStoreInventory> {
    const [item] = await db.insert(virtualStoreInventory)
      .values(data)
      .returning();
    return item;
  }

  async bulkCreateVirtualStoreInventory(data: InsertVirtualStoreInventory[]): Promise<{ success: number; errors: string[] }> {
    const errors: string[] = [];
    let success = 0;

    for (const item of data) {
      try {
        // Check if item already exists
        const existing = await this.getVirtualStoreInventoryBySn(item.kodeGudang, item.sn);
        if (existing) {
          // Update qty instead of inserting
          await db.update(virtualStoreInventory)
            .set({ 
              qty: sql`${virtualStoreInventory.qty} + ${item.qty || 1}`,
              updatedAt: new Date()
            })
            .where(eq(virtualStoreInventory.inventoryId, existing.inventoryId));
          success++;
        } else {
          await db.insert(virtualStoreInventory).values(item);
          success++;
        }
      } catch (error: any) {
        errors.push(`SN ${item.sn}: ${error.message}`);
      }
    }

    return { success, errors };
  }

  async updateVirtualStoreInventory(inventoryId: number, data: Partial<InsertVirtualStoreInventory>): Promise<VirtualStoreInventory> {
    const [item] = await db.update(virtualStoreInventory)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(virtualStoreInventory.inventoryId, inventoryId))
      .returning();
    return item;
  }

  async deleteVirtualStoreInventory(inventoryId: number): Promise<void> {
    await db.delete(virtualStoreInventory)
      .where(eq(virtualStoreInventory.inventoryId, inventoryId));
  }

  async adjustVirtualStoreInventoryQty(kodeGudang: string, sn: string, qtyChange: number): Promise<VirtualStoreInventory | null> {
    const existing = await this.getVirtualStoreInventoryBySn(kodeGudang, sn);
    if (!existing) {
      return null;
    }

    const newQty = existing.qty + qtyChange;
    if (newQty <= 0) {
      // Remove item if qty becomes 0 or negative
      await this.deleteVirtualStoreInventory(existing.inventoryId);
      return null;
    }

    const [updated] = await db.update(virtualStoreInventory)
      .set({ qty: newQty, updatedAt: new Date() })
      .where(eq(virtualStoreInventory.inventoryId, existing.inventoryId))
      .returning();
    return updated;
  }

  async transferVirtualInventory(fromStore: string, toStore: string, sn: string, qty: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Find item in source store
      const sourceItem = await this.getVirtualStoreInventoryBySn(fromStore, sn);
      if (!sourceItem) {
        return { success: false, error: `Item SN ${sn} not found in store ${fromStore}` };
      }

      if (sourceItem.qty < qty) {
        return { success: false, error: `Insufficient qty for SN ${sn}. Available: ${sourceItem.qty}, Requested: ${qty}` };
      }

      // Deduct from source
      await this.adjustVirtualStoreInventoryQty(fromStore, sn, -qty);

      // Add to destination
      const destItem = await this.getVirtualStoreInventoryBySn(toStore, sn);
      if (destItem) {
        await this.adjustVirtualStoreInventoryQty(toStore, sn, qty);
      } else {
        // Create new entry in destination
        await this.createVirtualStoreInventory({
          kodeGudang: toStore,
          sn: sn,
          kodeItem: sourceItem.kodeItem,
          sc: sourceItem.sc,
          namaBarang: sourceItem.namaBarang,
          qty: qty
        });
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async addToVirtualInventory(kodeGudang: string, item: { sn: string; kodeItem?: string | null; namaBarang?: string | null; qty: number }): Promise<VirtualStoreInventory> {
    // Enforce SN requirement - SN is mandatory for virtual inventory
    if (!item.sn || item.sn.trim() === '') {
      throw new Error('SN (serial number) is required for virtual inventory');
    }
    
    // Check if item with same SN already exists in this store
    const existing = await this.getVirtualStoreInventoryBySn(kodeGudang, item.sn.trim());
    
    if (existing) {
      // ADD to existing quantity (not replace)
      const newQty = existing.qty + item.qty;
      const [updated] = await db.update(virtualStoreInventory)
        .set({ 
          qty: newQty, 
          updatedAt: new Date(),
          // Update other fields if they were empty before
          kodeItem: existing.kodeItem || item.kodeItem,
          namaBarang: existing.namaBarang || item.namaBarang
        })
        .where(eq(virtualStoreInventory.inventoryId, existing.inventoryId))
        .returning();
      return updated;
    } else {
      // Create new entry
      const [created] = await db.insert(virtualStoreInventory)
        .values({
          kodeGudang,
          sn: item.sn,
          kodeItem: item.kodeItem || null,
          namaBarang: item.namaBarang || null,
          qty: item.qty
        })
        .returning();
      return created;
    }
  }

  // Bazar operations
  async getBazars(): Promise<Bazar[]> {
    return db.select().from(bazars).orderBy(desc(bazars.startDate));
  }

  async getBazarById(bazarId: number): Promise<Bazar | undefined> {
    const [result] = await db.select().from(bazars).where(eq(bazars.bazarId, bazarId));
    return result;
  }

  async getActiveBazars(): Promise<Bazar[]> {
    return db.select().from(bazars).where(eq(bazars.status, 'active')).orderBy(desc(bazars.startDate));
  }

  async createBazar(data: InsertBazar): Promise<Bazar> {
    const [result] = await db.insert(bazars).values(data).returning();
    return result;
  }

  async updateBazar(bazarId: number, data: Partial<InsertBazar>): Promise<Bazar> {
    const [result] = await db.update(bazars)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bazars.bazarId, bazarId))
      .returning();
    return result;
  }

  async deleteBazar(bazarId: number): Promise<void> {
    await db.delete(bazars).where(eq(bazars.bazarId, bazarId));
  }

  // Store Type operations implementation
  async getStoreTypes(): Promise<StoreType[]> {
    return await db.select().from(storeTypes).orderBy(desc(storeTypes.id));
  }

  async createStoreType(data: InsertStoreType): Promise<StoreType> {
    const [result] = await db.insert(storeTypes).values(data).returning();
    return result;
  }

  async updateStoreType(id: number, data: Partial<InsertStoreType>): Promise<StoreType> {
    const [result] = await db
      .update(storeTypes)
      .set(data)
      .where(eq(storeTypes.id, id))
      .returning();
    return result;
  }

  async deleteStoreType(id: number): Promise<void> {
    await db.delete(storeTypes).where(eq(storeTypes.id, id));
  }

  // Bazar Type operations implementation
  async getBazarTypes(): Promise<BazarType[]> {
    return await db.select().from(bazarTypes).orderBy(desc(bazarTypes.id));
  }

  async createBazarType(data: InsertBazarType): Promise<BazarType> {
    const [result] = await db.insert(bazarTypes).values(data).returning();
    return result;
  }

  async updateBazarType(id: number, data: Partial<InsertBazarType>): Promise<BazarType> {
    const [result] = await db
      .update(bazarTypes)
      .set(data)
      .where(eq(bazarTypes.id, id))
      .returning();
    return result;
  }

  async deleteBazarType(id: number): Promise<void> {
    await db.delete(bazarTypes).where(eq(bazarTypes.id, id));
  }
}

export const storage = new DatabaseStorage();
