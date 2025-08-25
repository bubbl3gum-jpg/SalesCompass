import {
  users,
  referenceSheet,
  stores,
  discountTypes,
  pricelist,
  openingStock,
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
  type OpeningStock,
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
  type InsertOpeningStock,
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
import { eq, and, sql, desc, sum } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Reference Sheet operations
  getReferenceSheets(): Promise<ReferenceSheet[]>;
  createReferenceSheet(data: InsertReferenceSheet): Promise<ReferenceSheet>;
  updateReferenceSheet(refId: number, data: Partial<InsertReferenceSheet>): Promise<ReferenceSheet>;
  deleteReferenceSheet(refId: number): Promise<void>;
  getReferenceSheetByKodeItem(kodeItem: string): Promise<ReferenceSheet | undefined>;

  // Store operations
  getStores(): Promise<Store[]>;
  createStore(data: InsertStore): Promise<Store>;
  getStoreByKode(kodeGudang: string): Promise<Store | undefined>;

  // Discount operations
  getDiscountTypes(): Promise<DiscountType[]>;
  createDiscountType(data: InsertDiscountType): Promise<DiscountType>;
  updateDiscountType(discountId: number, data: Partial<InsertDiscountType>): Promise<DiscountType>;
  deleteDiscountType(discountId: number): Promise<void>;

  // Pricelist operations
  getPricelist(): Promise<Pricelist[]>;
  createPricelist(data: InsertPricelist): Promise<Pricelist>;
  getPriceBySerial(serialNumber: string): Promise<Pricelist | undefined>;
  getPriceByKodeItem(kodeItem: string): Promise<Pricelist | undefined>;
  getPricesByFamilyAndMaterial(family: string, deskripsiMaterial: string): Promise<Pricelist[]>;

  // Sales operations
  createSale(data: InsertLaporanPenjualan): Promise<LaporanPenjualan>;
  getSales(kodeGudang?: string, tanggal?: string): Promise<LaporanPenjualan[]>;
  getSalesToday(kodeGudang: string): Promise<{ totalSales: string, count: number }>;

  // Settlement operations
  createSettlement(data: InsertSettlement): Promise<Settlement>;
  getSettlements(kodeGudang?: string, tanggal?: string): Promise<Settlement[]>;
  getSettlementByStoreAndDate(kodeGudang: string, tanggal: string): Promise<Settlement | undefined>;

  // Opening Stock operations
  getOpeningStock(): Promise<OpeningStock[]>;
  createOpeningStock(data: InsertOpeningStock): Promise<OpeningStock>;
  
  // Stock Opname operations
  getStockOpname(): Promise<StockOpname[]>;
  createStockOpname(data: InsertStockOpname): Promise<StockOpname>;
  createSoItemList(data: InsertSoItemList): Promise<SoItemList>;
  getSoItemListByStockOpnameId(soId: number): Promise<SoItemList[]>;

  // Transfer operations
  createTransferOrder(data: InsertTransferOrder): Promise<TransferOrder>;
  getTransferOrders(): Promise<TransferOrder[]>;

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
  updateStaff(employeeId: number, data: Partial<InsertStaff>): Promise<Staff>;
  deleteStaff(employeeId: number): Promise<void>;
  getStaffByEmail(email: string): Promise<Staff | undefined>;

  // Position operations
  getPositions(): Promise<Position[]>;
  createPosition(data: InsertPosition): Promise<Position>;
  updatePosition(positionId: number, data: Partial<InsertPosition>): Promise<Position>;
  deletePosition(positionId: number): Promise<void>;
  getPositionByName(positionName: string): Promise<Position | undefined>;
  getUserPermissions(userEmail: string): Promise<Position | null>;
  
  // Transfer order item list operations
  createToItemList(data: InsertToItemList): Promise<ToItemList>;
  getToItemListByTransferOrderId(toId: number): Promise<ToItemList[]>;
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

  async updateReferenceSheet(refId: number, data: Partial<InsertReferenceSheet>): Promise<ReferenceSheet> {
    const [result] = await db.update(referenceSheet)
      .set(data)
      .where(eq(referenceSheet.refId, refId))
      .returning();
    return result;
  }

  async deleteReferenceSheet(refId: number): Promise<void> {
    await db.delete(referenceSheet).where(eq(referenceSheet.refId, refId));
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

  async getStoreByKode(kodeGudang: string): Promise<Store | undefined> {
    const [result] = await db.select().from(stores).where(eq(stores.kodeGudang, kodeGudang));
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

  // Opening Stock operations
  async getOpeningStock(): Promise<OpeningStock[]> {
    return await db.select().from(openingStock);
  }
  
  async createOpeningStock(data: InsertOpeningStock): Promise<OpeningStock> {
    const [result] = await db.insert(openingStock).values(data).returning();
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

  async updateStaff(employeeId: number, data: Partial<InsertStaff>): Promise<Staff> {
    const [result] = await db.update(staff)
      .set(data)
      .where(eq(staff.employeeId, employeeId))
      .returning();
    return result;
  }

  async deleteStaff(employeeId: number): Promise<void> {
    await db.delete(staff).where(eq(staff.employeeId, employeeId));
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
    // Get staff record by email
    const staffMember = await this.getStaffByEmail(userEmail);
    
    if (!staffMember || !staffMember.jabatan) {
      // Default permissions for users without staff record or position
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
    
    // Get position by jabatan (position name)
    const position = await this.getPositionByName(staffMember.jabatan);
    
    if (!position) {
      // Default permissions if position not found
      return {
        positionId: 0,
        positionName: staffMember.jabatan,
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
    
    return position;
  }
  
  // Transfer order item list operations
  async createToItemList(data: InsertToItemList): Promise<ToItemList> {
    const [result] = await db.insert(toItemList).values(data).returning();
    return result;
  }
  
  async getToItemListByTransferOrderId(toId: number): Promise<ToItemList[]> {
    return await db.select().from(toItemList).where(eq(toItemList.toId, toId));
  }
}

export const storage = new DatabaseStorage();
