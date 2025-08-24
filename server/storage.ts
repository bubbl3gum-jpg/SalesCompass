import {
  users,
  referenceSheet,
  stores,
  discountTypes,
  pricelist,
  laporanPenjualan,
  settlements,
  stockLedger,
  transferOrders,
  paymentMethods,
  storePaymentMethods,
  userRoles,
  roles,
  staff,
  type User,
  type UpsertUser,
  type ReferenceSheet,
  type Store,
  type DiscountType,
  type Pricelist,
  type LaporanPenjualan,
  type Settlement,
  type StockLedger,
  type TransferOrder,
  type PaymentMethod,
  type InsertReferenceSheet,
  type InsertStore,
  type InsertDiscountType,
  type InsertPricelist,
  type InsertLaporanPenjualan,
  type InsertSettlement,
  type InsertStockLedger,
  type InsertTransferOrder,
  type InsertPaymentMethod,
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
  getReferenceSheetByKodeItem(kodeItem: string): Promise<ReferenceSheet | undefined>;

  // Store operations
  getStores(): Promise<Store[]>;
  createStore(data: InsertStore): Promise<Store>;
  getStoreByKode(kodeGudang: string): Promise<Store | undefined>;

  // Discount operations
  getDiscountTypes(): Promise<DiscountType[]>;
  createDiscountType(data: InsertDiscountType): Promise<DiscountType>;

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

  // Stock operations
  createStockLedgerEntry(data: InsertStockLedger): Promise<StockLedger>;
  getStockOnHand(kodeGudang: string, kodeItem?: string): Promise<{ kodeItem: string, serialNumber: string | null, qty: number }[]>;
  checkSerialAvailability(kodeGudang: string, serialNumber: string): Promise<boolean>;

  // Transfer operations
  createTransferOrder(data: InsertTransferOrder): Promise<TransferOrder>;
  getTransferOrders(): Promise<TransferOrder[]>;

  // Payment method operations
  getPaymentMethods(): Promise<PaymentMethod[]>;
  createPaymentMethod(data: InsertPaymentMethod): Promise<PaymentMethod>;

  // User roles and staff
  getUserRoles(userId: string): Promise<string[]>;
  createStaffUser(userData: any): Promise<void>;
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

  // Pricelist operations
  async getPricelist(): Promise<Pricelist[]> {
    return await db.select().from(pricelist);
  }

  async createPricelist(data: InsertPricelist): Promise<Pricelist> {
    const [result] = await db.insert(pricelist).values(data).returning();
    return result;
  }

  async getPriceBySerial(serialNumber: string): Promise<Pricelist | undefined> {
    const [result] = await db.select().from(pricelist).where(eq(pricelist.serialNumber, serialNumber));
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
    let query = db.select().from(laporanPenjualan);
    
    if (kodeGudang || tanggal) {
      const conditions = [];
      if (kodeGudang) conditions.push(eq(laporanPenjualan.kodeGudang, kodeGudang));
      if (tanggal) conditions.push(eq(laporanPenjualan.tanggal, tanggal));
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(laporanPenjualan.tanggal));
  }

  async getSalesToday(kodeGudang: string): Promise<{ totalSales: string, count: number }> {
    const today = new Date().toISOString().split('T')[0];
    const [result] = await db
      .select({
        totalSales: sql<string>`COALESCE(SUM(${laporanPenjualan.finalPrice}), 0)`,
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
    let query = db.select().from(settlements);
    
    if (kodeGudang || tanggal) {
      const conditions = [];
      if (kodeGudang) conditions.push(eq(settlements.kodeGudang, kodeGudang));
      if (tanggal) conditions.push(eq(settlements.tanggal, tanggal));
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(settlements.tanggal));
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

  // Stock operations
  async createStockLedgerEntry(data: InsertStockLedger): Promise<StockLedger> {
    const [result] = await db.insert(stockLedger).values(data).returning();
    return result;
  }

  async getStockOnHand(kodeGudang: string, kodeItem?: string): Promise<{ kodeItem: string, serialNumber: string | null, qty: number }[]> {
    let query = db
      .select({
        kodeItem: stockLedger.kodeItem,
        serialNumber: stockLedger.serialNumber,
        qty: sql<number>`SUM(${stockLedger.qty})`
      })
      .from(stockLedger)
      .where(eq(stockLedger.kodeGudang, kodeGudang))
      .groupBy(stockLedger.kodeItem, stockLedger.serialNumber);

    if (kodeItem) {
      query = query.where(
        and(
          eq(stockLedger.kodeGudang, kodeGudang),
          eq(stockLedger.kodeItem, kodeItem)
        )
      );
    }

    const results = await query;
    return results.filter(r => r.qty > 0);
  }

  async checkSerialAvailability(kodeGudang: string, serialNumber: string): Promise<boolean> {
    const [result] = await db
      .select({ qty: sql<number>`SUM(${stockLedger.qty})` })
      .from(stockLedger)
      .where(
        and(
          eq(stockLedger.kodeGudang, kodeGudang),
          eq(stockLedger.serialNumber, serialNumber)
        )
      );

    return (result?.qty || 0) > 0;
  }

  // Transfer operations
  async createTransferOrder(data: InsertTransferOrder): Promise<TransferOrder> {
    const [result] = await db.insert(transferOrders).values(data).returning();
    return result;
  }

  async getTransferOrders(): Promise<TransferOrder[]> {
    return await db.select().from(transferOrders).orderBy(desc(transferOrders.tanggal));
  }

  // Payment method operations
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    return await db.select().from(paymentMethods);
  }

  async createPaymentMethod(data: InsertPaymentMethod): Promise<PaymentMethod> {
    const [result] = await db.insert(paymentMethods).values(data).returning();
    return result;
  }

  // User roles and staff
  async getUserRoles(userId: string): Promise<string[]> {
    const userStaff = await db
      .select({ roleId: userRoles.roleId })
      .from(staff)
      .innerJoin(userRoles, eq(staff.employeeId, userRoles.employeeId))
      .where(eq(staff.email, userId));

    if (userStaff.length === 0) return [];

    const roleIds = userStaff.map(ur => ur.roleId);
    const roleNames = await db
      .select({ roleName: roles.roleName })
      .from(roles)
      .where(sql`${roles.roleId} = ANY(${roleIds})`);

    return roleNames.map(r => r.roleName || '');
  }

  async createStaffUser(userData: any): Promise<void> {
    // Implementation for creating staff user
    // This would be used during user setup/admin functions
  }
}

export const storage = new DatabaseStorage();
