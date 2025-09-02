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
  staff,
  positions,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, sum, or, ilike, inArray } from "drizzle-orm";

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
  deleteStore(kodeGudang: string): Promise<void>;
  getStoreByKode(kodeGudang: string): Promise<Store | undefined>;
  searchStores(query: string): Promise<Store[]>;

  // Discount operations
  getDiscountTypes(): Promise<DiscountType[]>;
  createDiscountType(data: InsertDiscountType): Promise<DiscountType>;
  updateDiscountType(discountId: number, data: Partial<InsertDiscountType>): Promise<DiscountType>;
  deleteDiscountType(discountId: number): Promise<void>;

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
  getSalesToday(kodeGudang: string): Promise<{ totalSales: string, count: number }>;
  getSaleById(penjualanId: number): Promise<LaporanPenjualan | undefined>;
  updateSale(penjualanId: number, data: Partial<InsertLaporanPenjualan>): Promise<LaporanPenjualan>;
  deleteSale(penjualanId: number): Promise<void>;

  // Settlement operations
  createSettlement(data: InsertSettlement): Promise<Settlement>;
  getSettlements(kodeGudang?: string, tanggal?: string): Promise<Settlement[]>;
  getSettlementByStoreAndDate(kodeGudang: string, tanggal: string): Promise<Settlement | undefined>;

  
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

  // Inventory search operations
  searchInventoryBySerial(storeCode: string, serialNumber: string): Promise<any[]>;
  searchInventoryByDetails(storeCode: string, searchQuery: string): Promise<any[]>;
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

  // Pricelist operations
  async getPricelist(): Promise<Pricelist[]> {
    return await db.select().from(pricelist);
  }

  async createPricelist(data: InsertPricelist): Promise<Pricelist> {
    const [result] = await db.insert(pricelist).values(data).returning();
    return result;
  }

  async getPriceBySerial(serialNumber: string): Promise<Pricelist | undefined> {
    const [result] = await db.select().from(pricelist).where(eq(pricelist.sn, serialNumber));
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
    if (!refItem) {
      return undefined;
    }

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

  async getSalesToday(kodeGudang: string): Promise<{ totalSales: string, count: number }> {
    const today = new Date().toISOString().split('T')[0];
    const [result] = await db
      .select({
        totalSales: sql<string>`COALESCE(SUM(${laporanPenjualan.discByAmount}), 0)`,
        count: sql<number>`COUNT(*)`
      })
      .from(laporanPenjualan)
      .where(
        and(
          eq(laporanPenjualan.kodeGudang, kodeGudang),
          eq(laporanPenjualan.tanggal, today)
        )
      );
    
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
  
  async createEdcSettlement(data: InsertEdcSettlement): Promise<EdcSettlement> {
    const [result] = await db.insert(edcSettlement).values(data).returning();
    return result;
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

  // Inventory search operations - searches actual store stock from transfer orders
  async searchInventoryBySerial(storeCode: string, serialNumber: string): Promise<any[]> {
    const results = await db
      .select({
        kodeItem: toItemList.kodeItem,
        namaItem: toItemList.namaItem,
        sn: toItemList.sn,
        qty: toItemList.qty,
        toNumber: toItemList.toNumber,
        keGudang: transferOrders.keGudang,
      })
      .from(toItemList)
      .leftJoin(transferOrders, eq(toItemList.toNumber, transferOrders.toNumber))
      .where(
        and(
          eq(toItemList.sn, serialNumber),
          storeCode === 'ALL_STORE' ? sql`1=1` : eq(transferOrders.keGudang, storeCode)
        )
      );

    // Use enhanced price resolution for each item
    const enhancedResults = await Promise.all(results.map(async (item) => {
      const priceInfo = item.kodeItem ? await this.getEnhancedPriceForItem(item.kodeItem, item.sn || undefined) : null;
      
      return {
        kodeItem: item.kodeItem,
        namaItem: item.namaItem,
        normalPrice: priceInfo?.normalPrice ? Number(priceInfo.normalPrice) : 0,
        sp: priceInfo?.sp ? Number(priceInfo.sp) : null,
        availableQuantity: item.qty,
        kelompok: priceInfo?.kelompok || null,
        family: priceInfo?.family || null,
        // Calculate sp discount percentage if sp exists and is less than normal price
        spDiscountPercentage: (priceInfo?.sp && priceInfo?.normalPrice && Number(priceInfo.sp) < Number(priceInfo.normalPrice)) 
          ? Math.round(((Number(priceInfo.normalPrice) - Number(priceInfo.sp)) / Number(priceInfo.normalPrice)) * 100) 
          : null,
      };
    }));

    return enhancedResults;
  }

  async searchInventoryByDetails(storeCode: string, searchQuery: string): Promise<any[]> {
    const searchLower = searchQuery.toLowerCase();
    
    // First get inventory items, then join with reference_sheet for better search
    const results = await db
      .select({
        kodeItem: toItemList.kodeItem,
        namaItem: toItemList.namaItem,
        sn: toItemList.sn,
        qty: toItemList.qty,
        toNumber: toItemList.toNumber,
        keGudang: transferOrders.keGudang,
        kelompok: referenceSheet.kelompok,
        family: referenceSheet.family,
      })
      .from(toItemList)
      .leftJoin(transferOrders, eq(toItemList.toNumber, transferOrders.toNumber))
      .leftJoin(referenceSheet, eq(toItemList.kodeItem, referenceSheet.kodeItem))
      .where(
        and(
          or(
            ilike(toItemList.kodeItem, `%${searchQuery}%`),
            ilike(toItemList.namaItem, `%${searchQuery}%`),
            ilike(referenceSheet.kelompok, `%${searchQuery}%`),
            ilike(referenceSheet.family, `%${searchQuery}%`)
          ),
          storeCode === 'ALL_STORE' ? sql`1=1` : eq(transferOrders.keGudang, storeCode)
        )
      );

    // Use enhanced price resolution for each item
    const enhancedResults = await Promise.all(results.map(async (item) => {
      const priceInfo = item.kodeItem ? await this.getEnhancedPriceForItem(item.kodeItem, item.sn || undefined) : null;
      
      return {
        kodeItem: item.kodeItem,
        namaItem: item.namaItem,
        normalPrice: priceInfo?.normalPrice ? Number(priceInfo.normalPrice) : 0,
        sp: priceInfo?.sp ? Number(priceInfo.sp) : null,
        availableQuantity: item.qty,
        kelompok: priceInfo?.kelompok || item.kelompok || null,
        family: priceInfo?.family || item.family || null,
        // Calculate sp discount percentage if sp exists and is less than normal price
        spDiscountPercentage: (priceInfo?.sp && priceInfo?.normalPrice && Number(priceInfo.sp) < Number(priceInfo.normalPrice)) 
          ? Math.round(((Number(priceInfo.normalPrice) - Number(priceInfo.sp)) / Number(priceInfo.normalPrice)) * 100) 
          : null,
      };
    }));

    return enhancedResults;
  }
}

export const storage = new DatabaseStorage();
