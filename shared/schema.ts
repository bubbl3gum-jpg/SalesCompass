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
  refId: integer("ref_id").primaryKey().generatedByDefaultAsIdentity(),
  kodeItem: varchar("kode_item", { length: 50 }).unique().notNull(),
  namaItem: varchar("nama_item", { length: 255 }),
  kelompok: varchar("kelompok", { length: 50 }),
  family: varchar("family", { length: 50 }),
  originalCode: varchar("original_code", { length: 100 }),
  color: varchar("color", { length: 50 }),
  kodeMaterial: varchar("kode_material", { length: 50 }),
  deskripsiMaterial: varchar("deskripsi_material", { length: 255 }),
  kodeMotif: varchar("kode_motif", { length: 50 }),
  deskripsiMotif: varchar("deskripsi_motif", { length: 255 }),
});

// Stores
export const stores = pgTable("store", {
  kodeGudang: varchar("kode_gudang", { length: 50 }).primaryKey(),
  namaGudang: varchar("nama_gudang", { length: 255 }),
  jenisGudang: varchar("jenis_gudang", { length: 50 }),
});

// Discount Types
export const discountTypes = pgTable("discount_types", {
  discountId: integer("discount_id").primaryKey().generatedByDefaultAsIdentity(),
  discountName: varchar("discount_name", { length: 100 }),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }),
  startFrom: date("start_from"),
  endAt: date("end_at"),
});

// Pricelist (denormalized with lookup fields)
export const pricelist = pgTable("pricelist", {
  pricelistId: integer("pricelist_id").primaryKey().generatedByDefaultAsIdentity(),
  serialNumber: varchar("serial_number", { length: 100 }),
  kodeItem: varchar("kode_item", { length: 50 }).references(() => referenceSheet.kodeItem),
  kelompok: varchar("kelompok", { length: 50 }),
  family: varchar("family", { length: 50 }),
  kodeMaterial: varchar("kode_material", { length: 50 }),
  kodeMotif: varchar("kode_motif", { length: 50 }),
  deskripsiMaterial: varchar("deskripsi_material", { length: 255 }),
  normalPrice: decimal("normal_price", { precision: 12, scale: 2 }),
  sp: decimal("sp", { precision: 12, scale: 2 }),
}, (table) => [
  index("idx_pricelist_sn").on(table.serialNumber),
  index("idx_pricelist_ki").on(table.kodeItem),
  index("idx_pricelist_family_desc").on(table.family, table.deskripsiMaterial),
  index("idx_pricelist_score").on(table.family, table.deskripsiMaterial, table.kelompok, table.kodeMotif),
]);

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
  openingStockId: integer("openingstock_id").primaryKey().generatedByDefaultAsIdentity(),
  serialNumber: varchar("serial_number", { length: 100 }),
  kodeItem: varchar("kode_item", { length: 50 }).references(() => referenceSheet.kodeItem),
  qty: integer("qty"),
  kodeGudang: varchar("kode_gudang", { length: 50 }).references(() => stores.kodeGudang),
}, (table) => [
  index("idx_opening_stock_item").on(table.kodeItem),
  index("idx_opening_stock_gudang").on(table.kodeGudang),
]);

// Payment Methods
export const paymentMethods = pgTable("payment_method", {
  paymentMethodId: integer("payment_method_id").primaryKey().generatedByDefaultAsIdentity(),
  methodName: varchar("method_name", { length: 255 }),
  methodType: varchar("method_type", { length: 50 }),
  provider: varchar("provider", { length: 100 }),
});

// Store Payment Methods
export const storePaymentMethods = pgTable("store_paymentmethod", {
  storePaymentMethodId: integer("storepaymentmethod_id").primaryKey().generatedByDefaultAsIdentity(),
  kodeGudang: varchar("kode_gudang", { length: 50 }).references(() => stores.kodeGudang),
  paymentMethodId: integer("payment_method_id").references(() => paymentMethods.paymentMethodId),
}, (table) => [
  index("uq_store_paymentmethod").on(table.kodeGudang, table.paymentMethodId),
]);

// Sales (Laporan Penjualan)
export const laporanPenjualan = pgTable("laporan_penjualan", {
  penjualanId: integer("penjualan_id").primaryKey().generatedByDefaultAsIdentity(),
  kodeGudang: varchar("kode_gudang", { length: 50 }).references(() => stores.kodeGudang),
  tanggal: date("tanggal"),
  serialNumber: varchar("serial_number", { length: 100 }),
  kodeItem: varchar("kode_item", { length: 50 }).references(() => referenceSheet.kodeItem),
  discountId: integer("discount_id").references(() => discountTypes.discountId),
  discByAmount: decimal("disc_by_amount", { precision: 12, scale: 2 }),
  paymentMethodId: integer("payment_method_id").references(() => paymentMethods.paymentMethodId),
  notes: varchar("notes", { length: 255 }),
  preOrder: boolean("pre_order").default(false),
  normalPrice: decimal("normal_price", { precision: 12, scale: 2 }),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }),
  finalPrice: decimal("final_price", { precision: 12, scale: 2 }),
}, (table) => [
  index("idx_laporan_gudang_tanggal").on(table.kodeGudang, table.tanggal),
  index("idx_laporan_serial").on(table.serialNumber),
  index("idx_laporan_item").on(table.kodeItem),
]);

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

// Payment Method Settlements
export const paymentMethodSettlements = pgTable("paymentmethod_settlement", {
  paymentMethodSettlementId: integer("paymentmethodsettlement_id").primaryKey().generatedByDefaultAsIdentity(),
  storePaymentMethodId: integer("storepaymentmethod_id").references(() => storePaymentMethods.storePaymentMethodId),
  settlementId: integer("settlement_id").references(() => settlements.settlementId),
  tanggal: date("tanggal"),
  settlementValue: decimal("settlement_value", { precision: 12, scale: 2 }),
});

// Jabatan (Job Positions)
export const jabatan = pgTable("jabatan", {
  jabatanId: integer("jabatan_id").primaryKey().generatedByDefaultAsIdentity(),
  jabatanName: varchar("jabatan_name", { length: 100 }).unique(),
});

// Staff
export const staff = pgTable("staff", {
  employeeId: integer("employee_id").primaryKey().generatedByDefaultAsIdentity(),
  email: varchar("email", { length: 255 }).unique(),
  namaLengkap: varchar("nama_lengkap", { length: 255 }),
  kota: varchar("kota", { length: 100 }),
  tanggalLahir: date("tanggal_lahir"),
  tanggalMasuk: date("tanggal_masuk"),
  bank: varchar("bank", { length: 100 }),
  noRekening: varchar("no_rekening", { length: 100 }),
  jabatanId: integer("jabatan_id").references(() => jabatan.jabatanId),
});

// Roles
export const roles = pgTable("roles", {
  roleId: integer("role_id").primaryKey().generatedByDefaultAsIdentity(),
  roleName: varchar("role_name", { length: 50 }).unique(),
});

// User Roles
export const userRoles = pgTable("user_roles", {
  userRoleId: integer("user_role_id").primaryKey().generatedByDefaultAsIdentity(),
  employeeId: integer("employee_id").references(() => staff.employeeId),
  roleId: integer("role_id").references(() => roles.roleId),
}, (table) => [
  index("uq_user_role").on(table.employeeId, table.roleId),
]);

// Transfer Orders
export const transferOrders = pgTable("transfer_order", {
  toId: integer("to_id").primaryKey().generatedByDefaultAsIdentity(),
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
  toId: integer("to_id").references(() => transferOrders.toId),
  serialNumber: varchar("serial_number", { length: 100 }),
  kodeItem: varchar("kode_item", { length: 50 }).references(() => referenceSheet.kodeItem),
  qty: integer("qty").default(1),
}, (table) => [
  index("idx_to_itemlist_to").on(table.toId),
  index("idx_to_itemlist_serial").on(table.serialNumber),
  index("idx_to_itemlist_item").on(table.kodeItem),
]);

// Stock Ledger (source of truth)
export const movementTypeEnum = pgEnum('movement_type', ['OPENING', 'SALE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT']);

export const stockLedger = pgTable("stock_ledger", {
  stockLedgerId: integer("stock_ledger_id").primaryKey().generatedByDefaultAsIdentity(),
  tanggal: date("tanggal"),
  kodeGudang: varchar("kode_gudang", { length: 50 }).references(() => stores.kodeGudang),
  kodeItem: varchar("kode_item", { length: 50 }).references(() => referenceSheet.kodeItem),
  serialNumber: varchar("serial_number", { length: 100 }),
  movementType: movementTypeEnum("movement_type"),
  qty: integer("qty"),
  refType: varchar("ref_type", { length: 50 }),
  refId: integer("ref_id"),
}, (table) => [
  index("idx_stock_gudang_tanggal").on(table.kodeGudang, table.tanggal),
  index("idx_stock_item").on(table.kodeItem),
  index("idx_stock_serial").on(table.serialNumber),
  index("idx_stock_ref").on(table.refType, table.refId),
]);

// Relations
export const referenceSheetRelations = relations(referenceSheet, ({ many }) => ({
  pricelist: many(pricelist),
  openingStock: many(openingStock),
  laporanPenjualan: many(laporanPenjualan),
  toItemList: many(toItemList),
  stockLedger: many(stockLedger),
}));

export const storesRelations = relations(stores, ({ many }) => ({
  openingStock: many(openingStock),
  laporanPenjualan: many(laporanPenjualan),
  settlements: many(settlements),
  storePaymentMethods: many(storePaymentMethods),
  transferOrdersFrom: many(transferOrders, { relationName: "dariGudang" }),
  transferOrdersTo: many(transferOrders, { relationName: "keGudang" }),
  stockLedger: many(stockLedger),
}));

export const pricelistRelations = relations(pricelist, ({ one, many }) => ({
  referenceSheet: one(referenceSheet, {
    fields: [pricelist.kodeItem],
    references: [referenceSheet.kodeItem],
  }),
  pricelistDiscounts: many(pricelistDiscount),
}));

export const discountTypesRelations = relations(discountTypes, ({ many }) => ({
  pricelistDiscounts: many(pricelistDiscount),
  storeDiscounts: many(storeDiscounts),
  laporanPenjualan: many(laporanPenjualan),
}));

export const laporanPenjualanRelations = relations(laporanPenjualan, ({ one }) => ({
  store: one(stores, {
    fields: [laporanPenjualan.kodeGudang],
    references: [stores.kodeGudang],
  }),
  referenceSheet: one(referenceSheet, {
    fields: [laporanPenjualan.kodeItem],
    references: [referenceSheet.kodeItem],
  }),
  discount: one(discountTypes, {
    fields: [laporanPenjualan.discountId],
    references: [discountTypes.discountId],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [laporanPenjualan.paymentMethodId],
    references: [paymentMethods.paymentMethodId],
  }),
}));

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

export type InsertLaporanPenjualan = typeof laporanPenjualan.$inferInsert;
export type LaporanPenjualan = typeof laporanPenjualan.$inferSelect;

export type InsertSettlement = typeof settlements.$inferInsert;
export type Settlement = typeof settlements.$inferSelect;

export type InsertStockLedger = typeof stockLedger.$inferInsert;
export type StockLedger = typeof stockLedger.$inferSelect;

export type InsertTransferOrder = typeof transferOrders.$inferInsert;
export type TransferOrder = typeof transferOrders.$inferSelect;

export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;
export type PaymentMethod = typeof paymentMethods.$inferSelect;

// Schemas for validation
export const insertReferenceSheetSchema = createInsertSchema(referenceSheet).omit({ refId: true });
export const insertStoreSchema = createInsertSchema(stores);
export const insertDiscountTypeSchema = createInsertSchema(discountTypes).omit({ discountId: true });
export const insertPricelistSchema = createInsertSchema(pricelist).omit({ pricelistId: true });
export const insertLaporanPenjualanSchema = createInsertSchema(laporanPenjualan).omit({ penjualanId: true });
export const insertSettlementSchema = createInsertSchema(settlements).omit({ settlementId: true });
export const insertStockLedgerSchema = createInsertSchema(stockLedger).omit({ stockLedgerId: true });
export const insertTransferOrderSchema = createInsertSchema(transferOrders).omit({ toId: true });
