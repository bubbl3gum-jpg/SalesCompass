#!/usr/bin/env tsx

// Utility script to process all unprocessed transfer orders to stock
// This is a one-time utility to fix the issue where most transfers haven't been processed

import { storage } from './storage';

async function processAllUnprocessedTransfers() {
  console.log('='.repeat(60));
  console.log('🚀 Starting Transfer-to-Stock Processing Utility');
  console.log('='.repeat(60));
  
  try {
    // Get all unprocessed transfers
    const unprocessedTransfers = await storage.getUnprocessedTransfers();
    console.log(`\n📊 Found ${unprocessedTransfers.length} unprocessed transfers`);
    
    if (unprocessedTransfers.length === 0) {
      console.log('✅ All transfers are already processed!');
      process.exit(0);
    }
    
    // Display transfers to process
    console.log('\nTransfers to process:');
    unprocessedTransfers.forEach((transfer, index) => {
      console.log(`  ${index + 1}. ${transfer.toNumber} - ${transfer.dariGudang} → ${transfer.keGudang} (${transfer.itemCount} items)`);
    });
    
    // Process each transfer
    const results = {
      successful: [] as string[],
      failed: [] as { toNumber: string; error: string }[],
      totalItems: 0
    };
    
    console.log('\n' + '='.repeat(60));
    console.log('Processing transfers...');
    console.log('='.repeat(60));
    
    for (const transfer of unprocessedTransfers) {
      try {
        console.log(`\n📦 Processing transfer ${transfer.toNumber}...`);
        const result = await storage.processTransferToStock(transfer.toNumber);
        
        if (result.processed > 0) {
          results.successful.push(transfer.toNumber);
          results.totalItems += result.processed;
          console.log(`   ✅ SUCCESS: Processed ${result.processed} items`);
        } else if (result.errors.length > 0 && result.errors[0].includes('already been processed')) {
          console.log(`   ⏭️ SKIPPED: Transfer already processed`);
        } else {
          results.failed.push({
            toNumber: transfer.toNumber,
            error: result.errors.join(', ')
          });
          console.log(`   ❌ FAILED: ${result.errors.join(', ')}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({
          toNumber: transfer.toNumber,
          error: errorMsg
        });
        console.error(`   ❌ ERROR: ${errorMsg}`);
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 PROCESSING SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successful transfers: ${results.successful.length}`);
    if (results.successful.length > 0) {
      console.log('   Transfers:', results.successful.join(', '));
    }
    console.log(`❌ Failed transfers: ${results.failed.length}`);
    if (results.failed.length > 0) {
      results.failed.forEach(f => {
        console.log(`   ${f.toNumber}: ${f.error}`);
      });
    }
    console.log(`📦 Total items processed: ${results.totalItems}`);
    console.log('='.repeat(60));
    
    // Check final status
    const remainingUnprocessed = await storage.getUnprocessedTransfers();
    if (remainingUnprocessed.length === 0) {
      console.log('\n🎉 SUCCESS: All transfers have been processed to stock!');
    } else {
      console.log(`\n⚠️ WARNING: ${remainingUnprocessed.length} transfers remain unprocessed`);
      console.log('Remaining:', remainingUnprocessed.map(t => t.toNumber).join(', '));
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    // Exit cleanly
    process.exit(0);
  }
}

// Run the utility
console.log('Starting transfer processing utility...\n');
processAllUnprocessedTransfers().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});