// High-performance import worker that processes jobs asynchronously
import { jobQueue, ImportJob } from './jobQueue';
import { StreamingCSVParser, StreamingExcelParser, ParsedRow } from './streamingParser';
import { BulkLoader } from './bulkLoader';
import { createStagingTables, cleanupStagingData } from './stagingTables';

export class ImportWorker {
  private bulkLoader = new BulkLoader();
  private csvParser = new StreamingCSVParser();
  private excelParser = new StreamingExcelParser();

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Ensure staging tables exist
    await createStagingTables();
    
    // Listen for job processing events
    jobQueue.on('processJob', this.processJob.bind(this));
  }

  // Main job processing method
  private async processJob(job: ImportJob) {
    try {
      jobQueue.updateProgress(job.id, 0, 0, 'Starting import...');
      
      // Stage 1: Parse file with streaming
      const parsedRows = await this.parseFile(job);
      if (parsedRows.length === 0) {
        throw new Error('No valid data found in file');
      }

      jobQueue.updateProgress(job.id, 0, parsedRows.length, 'Parsed file, loading to staging...');

      // Stage 2: Bulk load to staging tables
      const bulkResult = await this.bulkLoader.bulkLoadToStaging(
        job.id,
        job.tableName,
        parsedRows,
        (loaded, total) => {
          jobQueue.updateProgress(job.id, loaded, total, 'Loading to staging...', bulkResult?.throughputRps);
        },
        job.additionalData
      );

      jobQueue.updateProgress(job.id, parsedRows.length, parsedRows.length, 'Validating data...');

      // Stage 3: Validate staging data
      const validationResult = await this.bulkLoader.validateStagingData(job.id, job.tableName);

      if (validationResult.invalid > 0) {
        console.log(`Found ${validationResult.invalid} invalid rows, proceeding with valid data`);
      }

      jobQueue.updateProgress(job.id, parsedRows.length, parsedRows.length, 'Finalizing import...');

      // Stage 4: Atomic upsert to target tables
      const upsertResult = await this.bulkLoader.atomicUpsert(job.id, job.tableName);

      // Stage 5: Clean up staging data
      await cleanupStagingData(job.id);

      // Complete the job
      const result = {
        success: upsertResult.inserted + upsertResult.updated,
        failed: validationResult.invalid,
        errors: validationResult.errors.map(e => e.error),
        failedRecords: validationResult.errors.map(e => ({
          record: {},
          error: e.error,
          originalIndex: e.rowNumber
        })),
        summary: {
          totalRecords: parsedRows.length,
          newRecords: upsertResult.inserted,
          updatedRecords: upsertResult.updated,
          duplicatesRemoved: 0,
          errorRecords: validationResult.invalid
        }
      };

      jobQueue.completeJob(job.id, result);

    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      
      // Clean up staging data on failure
      await cleanupStagingData(job.id);
      
      jobQueue.failJob(job.id, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Parse file using streaming parsers
  private async parseFile(job: ImportJob): Promise<ParsedRow[]> {
    const parsedRows: ParsedRow[] = [];
    
    try {
      const isCSV = job.fileName.toLowerCase().endsWith('.csv');
      const parser = isCSV ? this.csvParser : this.excelParser;
      
      for await (const row of parser.parseStream(job.fileBuffer, job.tableName, job.id)) {
        parsedRows.push(row);
        
        // Update progress every 1000 rows
        if (parsedRows.length % 1000 === 0) {
          jobQueue.updateProgress(job.id, parsedRows.length, 0, 'Parsing file...');
        }
      }
      
      return parsedRows.filter(row => row.isValid);
      
    } catch (error) {
      console.error('File parsing error:', error);
      throw new Error(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Start the worker
export const importWorker = new ImportWorker();