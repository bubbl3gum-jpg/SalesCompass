import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  integer,
  date,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reference Sheet
export const referenceSheet = pgTable("reference_sheet", {
  kodeItem: varchar("kode_item", { length: 50 }).primaryKey().notNull(),
  namaItem: varchar("nama_item", { length: 255 }),
  kelompok: varchar("kelompok", { length: 100 }),
  family: varchar("family", { length: 100 }),
  originalCode: varchar("original_code", { length: 150 }),
  color: varchar("color", { length: 100 }),
  kodeMaterial: varchar("kode_material", { length: 100 }),
  deskripsiMaterial: varchar("deskripsi_material", { length: 500 }),
  kodeMotif: varchar("kode_motif", { length: 100 }),
  deskripsiMotif: varchar("deskripsi_motif", { length: 500 }),
});

// Stores
export const stores = pgTable("store", {
  kodeGudang: varchar("kode_gudang", { length: 50 }).primaryKey(),
  namaGudang: varchar("nama_gudang", { length: 255 }),
  jenisGudang: varchar("jenis_gudang", { length: 50 }),
  storeUsername: varchar("store_username", { length: 100 }),
  storePassword: varchar("store_password", { length: 255 }),
});

// Discount Types
export const discountTypes = pgTable("discount_types", {
  discountId: integer("discount_id").primaryKey().generatedByDefaultAsIdentity(),
  discountName: varchar("discount_name", { length: 255 }),
  discountType: varchar("discount_type", { length: 100 }),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).notNull(),
  startFrom: date("start_from"),
  endAt: date("end_at"),
});

// Pricelist
export const pricelist = pgTable("pricelist", {
  pricelistId: integer("pricelist_id").primaryKey().generatedByDefaultAsIdentity(),
  sn: varchar("sn", { length: 100 }),
  kodeItem: varchar("kode_item", { length: 50 }),
  kelompok: varchar("kelompok", { length: 50 }),
  family: varchar("family", { length: 50 }),
  deskripsiMaterial: varchar("deskripsi_material", { length: 255 }),
  kodeMotif: varchar("kode_motif", { length: 50 }),
  namaMotif: varchar("nama_motif", { length: 255 }),
  normalPrice: decimal("normal_price", { precision: 12, scale: 2 }),
  sp: decimal("sp", { precision: 12, scale: 2 }),
});

// Pricelist Discount
export const pricelistDiscount = pgTable("pricelist_discount", {
  pricelistDiscountId: integer("pricelistdiscount_id").primaryKey().generatedByDefaultAsIdentity(),
  pricelistId: integer("pricelist_id").references(() => pricelist.pricelistId),
  discountId: integer("discount_id").references(() => discountTypes.discountId),
}, (table) => [
  index("uq_pricelist_discount").on(table.pricelistId, table.discountId),
]);

// Store Discounts
export const storeDiscounts = pgTable("store_discounts", {
  storeDiscountsId: integer("storediscounts_id").primaryKey().generatedByDefaultAsIdentity(),
  kodeGudang: varchar("kode_gudang", { length: 50 }).references(() => stores.kodeGudang),
  discountId: integer("discount_id").references(() => discountTypes.discountId),
}, (table) => [
  index("uq_store_discount").on(table.kodeGudang, table.discountId),
]);

// Opening Stock
export const openingStock = pgTable("opening_stock", {
  itemId: integer("item_id").primaryKey().generatedByDefaultAsIdentity(),
  sn: varchar("sn", { length: 100 }),
  kodeItem: varchar("kode_item", { length: 50 }),
  kelompok: varchar("kelompok", { length: 50 }),
  family: varchar("family", { length: 50 }),
  deskripsiMaterial: varchar("deskripsi_material", { length: 255 }),
  kodeMotif: varchar("kode_motif", { length: 50 }),
  namaItem: varchar("nama_item", { length: 255 }),
  qty: integer("qty"),
});

// EDC
export const edc = pgTable("edc", {
  edcId: integer("edc_id").primaryKey().generatedByDefaultAsIdentity(),
  merchantName: varchar("merchant_name", { length: 255 }),
  edcType: varchar("edc_type", { length: 50 }),
});

// Store EDC
export const storeEdc = pgTable("store_edc", {
  storeEdcId: integer("storeedc_id").primaryKey().generatedByDefaultAsIdentity(),
  kodeGudang: varchar("kode_gudang", { length: 50 }),
  edcId: integer("edc_id"),
  namaGudang: varchar("nama_gudang", { length: 255 }),
  merchantName: varchar("merchant_name", { length: 255 }),
  edcType: varchar("edc_type", { length: 50 }),
});

// Sales (Laporan Penjualan)
export const laporanPenjualan = pgTable("laporan_penjualan", {
  penjualanId: integer("penjualan_id").primaryKey().generatedByDefaultAsIdentity(),
  kodeGudang: varchar("kode_gudang", { length: 50 }),
  itemId: integer("item_id"),
  tanggal: date("tanggal"),
  sn: varchar("sn", { length: 100 }),
  kodeItem: varchar("kode_item", { length: 50 }),
  discountType: varchar("discount_type", { length: 100 }),
  discByAmount: decimal("disc_by_amount", { precision: 12, scale: 2 }),
  paymentMethod: varchar("payment_method", { length: 100 }),
  notes: varchar("notes", { length: 255 }),
  preOrder: boolean("pre_order").default(false),
});

// Settlements
export const settlements = pgTable("settlement", {
  settlementId: integer("settlement_id").primaryKey().generatedByDefaultAsIdentity(),
  kodeGudang: varchar("kode_gudang", { length: 50 }).references(() => stores.kodeGudang),
  tanggal: date("tanggal"),
  cashAwal: decimal("cash_awal", { precision: 12, scale: 2 }),
  cashAkhir: decimal("cash_akhir", { precision: 12, scale: 2 }),
  variance: decimal("variance", { precision: 12, scale: 2 }),
}, (table) => [
  index("uq_settlement_gudang_tanggal").on(table.kodeGudang, table.tanggal),
]);

// EDC Settlement
export const edcSettlement = pgTable("edc_settlement", {
  edcSettlementId: integer("edcsettlement_id").primaryKey().generatedByDefaultAsIdentity(),
  storeEdcId: integer("storeedc_id"),
  settlementId: integer("settlement_id"),
  tanggal: date("tanggal"),
  namaGudang: varchar("nama_gudang", { length: 255 }),
  merchantName: varchar("merchant_name", { length: 255 }),
  settlementValue: decimal("settlement_value", { precision: 12, scale: 2 }),
});

// Staff
// Position table for job positions
export const positions = pgTable("positions", {
  positionId: integer("position_id").primaryKey().generatedByDefaultAsIdentity(),
  positionName: varchar("position_name", { length: 100 }).unique(),
  description: varchar("description", { length: 255 }),
  // System Access Permissions
  canAccessDashboard: boolean("can_access_dashboard").default(true),
  canAccessSalesEntry: boolean("can_access_sales_entry").default(false),
  canAccessSettlements: boolean("can_access_settlements").default(false),
  canAccessStockDashboard: boolean("can_access_stock_dashboard").default(false),
  canAccessStockOpname: boolean("can_access_stock_opname").default(false),
  canAccessTransfers: boolean("can_access_transfers").default(false),
  canAccessPriceLists: boolean("can_access_price_lists").default(false),
  canAccessDiscounts: boolean("can_access_discounts").default(false),
  canAccessAdminSettings: boolean("can_access_admin_settings").default(false),
});

export const staff = pgTable("staff", {
  nik: varchar("nik", { length: 50 }).primaryKey().notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  namaLengkap: varchar("nama_lengkap", { length: 255 }).notNull(),
  kota: varchar("kota", { length: 100 }).notNull(),
  alamat: varchar("alamat", { length: 255 }).notNull(),
  noHp: varchar("no_hp", { length: 20 }).notNull(),
  tempatLahir: varchar("tempat_lahir", { length: 100 }).notNull(),
  tanggalLahir: date("tanggal_lahir").notNull(),
  tanggalMasuk: date("tanggal_masuk").notNull(),
  jabatan: varchar("jabatan", { length: 100 }).notNull(),
});

// Transfer Orders
export const transferOrders = pgTable("transfer_order", {
  toId: integer("to_id").generatedByDefaultAsIdentity(),
  toNumber: varchar("to_number", { length: 50 }).primaryKey().notNull(), // Primary key now
  dariGudang: varchar("dari_gudang", { length: 50 }).references(() => stores.kodeGudang),
  keGudang: varchar("ke_gudang", { length: 50 }).references(() => stores.kodeGudang),
  tanggal: date("tanggal"),
}, (table) => [
  index("idx_transfer_dari").on(table.dariGudang),
  index("idx_transfer_ke").on(table.keGudang),
  index("idx_transfer_tanggal").on(table.tanggal),
]);

// Transfer Order Item List
export const toItemList = pgTable("to_itemlist", {
  toItemListId: integer("to_itemlist_id").primaryKey().generatedByDefaultAsIdentity(),
  toNumber: varchar("to_number", { length: 50 }).notNull().references(() => transferOrders.toNumber, { onUpdate: "cascade", onDelete: "cascade" }),
  lineNo: integer("line_no"), // Line number from import
  sn: varchar("sn", { length: 100 }),
  kodeItem: varchar("kode_item", { length: 50 }),
  namaItem: varchar("nama_item", { length: 255 }),
  qty: integer("qty").default(1),
}, (table) => [
  index("idx_to_itemlist_line_no").on(table.toNumber, table.lineNo),
]);

// Stock Opname
export const stockOpname = pgTable("stock_opname", {
  soId: integer("so_id").primaryKey().generatedByDefaultAsIdentity(),
  kodeGudang: varchar("kode_gudang", { length: 50 }),
  tanggal: date("tanggal"),
});

// Stock Opname Item List
export const soItemList = pgTable("so_itemlist", {
  soItemListId: integer("so_itemlist_id").primaryKey().generatedByDefaultAsIdentity(),
  soId: integer("so_id"),
  sn: varchar("sn", { length: 100 }),
  kodeItem: varchar("kode_item", { length: 50 }),
  namaItem: varchar("nama_item", { length: 255 }),
  qty: integer("qty"),
});



// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertReferenceSheet = typeof referenceSheet.$inferInsert;
export type ReferenceSheet = typeof referenceSheet.$inferSelect;

export type InsertStore = typeof stores.$inferInsert;
export type Store = typeof stores.$inferSelect;

export type InsertDiscountType = typeof discountTypes.$inferInsert;
export type DiscountType = typeof discountTypes.$inferSelect;

export type InsertPricelist = typeof pricelist.$inferInsert;
export type Pricelist = typeof pricelist.$inferSelect;

export type InsertOpeningStock = typeof openingStock.$inferInsert;
export type OpeningStock = typeof openingStock.$inferSelect;

export type InsertLaporanPenjualan = typeof laporanPenjualan.$inferInsert;
export type LaporanPenjualan = typeof laporanPenjualan.$inferSelect;

export type InsertSettlement = typeof settlements.$inferInsert;
export type Settlement = typeof settlements.$inferSelect;

export type InsertTransferOrder = typeof transferOrders.$inferInsert;
export type TransferOrder = typeof transferOrders.$inferSelect;

export type InsertToItemList = typeof toItemList.$inferInsert;
export type ToItemList = typeof toItemList.$inferSelect;

export type InsertStockOpname = typeof stockOpname.$inferInsert;
export type StockOpname = typeof stockOpname.$inferSelect;

export type InsertSoItemList = typeof soItemList.$inferInsert;
export type SoItemList = typeof soItemList.$inferSelect;

export type InsertEdc = typeof edc.$inferInsert;
export type Edc = typeof edc.$inferSelect;

export type InsertStoreEdc = typeof storeEdc.$inferInsert;
export type StoreEdc = typeof storeEdc.$inferSelect;

export type InsertEdcSettlement = typeof edcSettlement.$inferInsert;
export type EdcSettlement = typeof edcSettlement.$inferSelect;

export type InsertStaff = typeof staff.$inferInsert;
export type Staff = typeof staff.$inferSelect;

export type InsertPosition = typeof positions.$inferInsert;
export type Position = typeof positions.$inferSelect;

// Schemas for validation
export const insertReferenceSheetSchema = createInsertSchema(referenceSheet);
export const insertStoreSchema = createInsertSchema(stores);
export const insertDiscountTypeSchema = createInsertSchema(discountTypes).omit({ discountId: true }).extend({
  discountAmount: z.coerce.number().min(0, "Discount amount must be positive")
});
export const insertPricelistSchema = createInsertSchema(pricelist).omit({ pricelistId: true });
export const insertOpeningStockSchema = createInsertSchema(openingStock).omit({ itemId: true });
export const insertLaporanPenjualanSchema = createInsertSchema(laporanPenjualan).omit({ penjualanId: true });
export const insertSettlementSchema = createInsertSchema(settlements).omit({ settlementId: true });
export const insertTransferOrderSchema = createInsertSchema(transferOrders).omit({ toId: true });
export const insertToItemListSchema = createInsertSchema(toItemList).omit({ toItemListId: true });
export const insertStockOpnameSchema = createInsertSchema(stockOpname).omit({ soId: true });
export const insertSoItemListSchema = createInsertSchema(soItemList).omit({ soItemListId: true });
export const insertEdcSchema = createInsertSchema(edc).omit({ edcId: true });
export const insertStoreEdcSchema = createInsertSchema(storeEdc).omit({ storeEdcId: true });
export const insertEdcSettlementSchema = createInsertSchema(edcSettlement).omit({ edcSettlementId: true });
export const insertStaffSchema = createInsertSchema(staff);
export const insertPositionSchema = createInsertSchema(positions).omit({ positionId: true });
