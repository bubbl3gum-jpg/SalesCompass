// Test script to verify stock update on sale functionality
import { storage } from "./server/storage";
import { db } from "./server/db";
import { stock, laporanPenjualan } from "./shared/schema";
import { eq, and, sql } from "drizzle-orm";

async function testStockUpdate() {
  console.log("🧪 Starting Stock Update Test\n");
  
  const testSerialNumber = "2509-249-L2"; // HD4 TRIPLE-S CG
  const testStore = "B-CGI";
  const testDate = "2025-01-14";
  const testKodeItem = "HD4 TRIPLE-S CG";
  
  try {
    // 1. Check initial stock state
    console.log("📊 STEP 1: Checking initial stock state...");
    const initialStock = await db
      .select()
      .from(stock)
      .where(
        and(
          eq(stock.serialNumber, testSerialNumber),
          eq(stock.kodeGudang, testStore)
        )
      );
    
    console.log("Initial stock record:");
    console.log(JSON.stringify(initialStock[0], null, 2));
    console.log(`tanggal_out status: ${initialStock[0]?.tanggalOut ? 'SOLD' : 'AVAILABLE'}\n`);
    
    // 2. Create a test sale entry
    console.log("💰 STEP 2: Creating test sale entry...");
    const saleData = {
      kodeGudang: testStore,
      tanggal: testDate,
      sn: testSerialNumber,
      kodeItem: testKodeItem,
      discByAmount: "45000",
      paymentMethod: "Cash",
      notes: "Test sale for stock update verification"
    };
    
    const [newSale] = await db
      .insert(laporanPenjualan)
      .values(saleData)
      .returning();
    
    console.log(`Sale created with ID: ${newSale.penjualanId}`);
    console.log(`Serial Number: ${newSale.sn}`);
    console.log(`Store: ${newSale.kodeGudang}`);
    console.log(`Date: ${newSale.tanggal}\n`);
    
    // 3. Call updateStockOnSale
    console.log("🔄 STEP 3: Calling updateStockOnSale...");
    const updateResult = await storage.updateStockOnSale(
      testSerialNumber,
      testStore,
      testDate
    );
    
    console.log(`Update result: ${updateResult ? '✅ SUCCESS' : '❌ FAILED'}\n`);
    
    // 4. Check final stock state
    console.log("📊 STEP 4: Checking final stock state...");
    const finalStock = await db
      .select()
      .from(stock)
      .where(
        and(
          eq(stock.serialNumber, testSerialNumber),
          eq(stock.kodeGudang, testStore)
        )
      );
    
    console.log("Final stock record:");
    console.log(JSON.stringify(finalStock[0], null, 2));
    console.log(`tanggal_out status: ${finalStock[0]?.tanggalOut ? 'SOLD on ' + finalStock[0].tanggalOut : 'AVAILABLE'}\n`);
    
    // 5. Verify the update
    console.log("✅ STEP 5: Verification Results:");
    console.log("================================");
    console.log(`Serial Number: ${testSerialNumber}`);
    console.log(`Store: ${testStore}`);
    console.log(`Sale Date: ${testDate}`);
    console.log(`Initial tanggal_out: ${initialStock[0]?.tanggalOut || 'NULL (Available)'}`);
    console.log(`Final tanggal_out: ${finalStock[0]?.tanggalOut || 'NULL (Still Available)'}`);
    
    if (finalStock[0]?.tanggalOut === testDate) {
      console.log("\n🎉 TEST PASSED: Stock was correctly updated with tanggal_out!");
    } else {
      console.log("\n❌ TEST FAILED: Stock was not updated as expected.");
    }
    
    // 6. Show comparison table
    console.log("\n📋 COMPARISON TABLE:");
    console.log("+-----------------+----------------------+----------------------+");
    console.log("| Field           | Before Sale          | After Sale           |");
    console.log("+-----------------+----------------------+----------------------+");
    console.log(`| Serial Number   | ${testSerialNumber.padEnd(20)} | ${testSerialNumber.padEnd(20)} |`);
    console.log(`| Store           | ${testStore.padEnd(20)} | ${testStore.padEnd(20)} |`);
    console.log(`| tanggal_in      | ${(initialStock[0]?.tanggalIn || 'NULL').toString().padEnd(20)} | ${(finalStock[0]?.tanggalIn || 'NULL').toString().padEnd(20)} |`);
    console.log(`| tanggal_out     | ${(initialStock[0]?.tanggalOut || 'NULL').toString().padEnd(20)} | ${(finalStock[0]?.tanggalOut || 'NULL').toString().padEnd(20)} |`);
    console.log(`| Quantity        | ${(initialStock[0]?.qty || 0).toString().padEnd(20)} | ${(finalStock[0]?.qty || 0).toString().padEnd(20)} |`);
    console.log(`| Status          | ${(initialStock[0]?.tanggalOut ? 'SOLD' : 'AVAILABLE').padEnd(20)} | ${(finalStock[0]?.tanggalOut ? 'SOLD' : 'AVAILABLE').padEnd(20)} |`);
    console.log("+-----------------+----------------------+----------------------+");
    
  } catch (error) {
    console.error("❌ Test failed with error:", error);
  }
  
  process.exit(0);
}

// Run the test
testStockUpdate();