// High-performance job queue system for non-blocking imports
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export interface ImportJob {
  id: string;
  idempotencyKey: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  tableName: string;
  fileName: string;
  fileBuffer: Buffer;
  additionalData?: any;
  progress: {
    current: number;
    total: number;
    stage: string;
    throughputRps?: number;
    eta?: number;
  };
  result?: {
    success: number;
    failed: number;
    errors: string[];
    failedRecords: Array<{ record: any; error: string; originalIndex: number }>;
    summary: {
      totalRecords: number;
      newRecords: number;
      updatedRecords: number;
      duplicatesRemoved: number;
      errorRecords: number;
    };
  };
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

class JobQueue extends EventEmitter {
  private jobs = new Map<string, ImportJob>();
  private queue: string[] = [];
  private processing = new Set<string>();
  private maxConcurrentJobs = 2; // Limit concurrent jobs to maintain API performance
  private workers: Promise<void>[] = [];
  private isShutdown = false;

  constructor() {
    super();
    this.startWorkers();
  }

  // Add a new import job to the queue
  async addJob(
    tableName: string,
    fileName: string,
    fileBuffer: Buffer,
    idempotencyKey?: string,
    additionalData?: any
  ): Promise<string> {
    // Generate idempotency key if not provided
    const key = idempotencyKey || `${tableName}_${fileName}_${Date.now()}`;
    
    // Check for existing job with same idempotency key
    const existingJob = Array.from(this.jobs.values()).find(job => job.idempotencyKey === key);
    if (existingJob) {
      return existingJob.id;
    }

    const jobId = randomUUID();
    const job: ImportJob = {
      id: jobId,
      idempotencyKey: key,
      status: 'queued',
      tableName,
      fileName,
      fileBuffer,
      additionalData,
      progress: {
        current: 0,
        total: 0,
        stage: 'Queued'
      },
      createdAt: new Date()
    };

    this.jobs.set(jobId, job);
    this.queue.push(jobId);
    
    this.emit('jobAdded', job);
    this.processQueue();
    
    return jobId;
  }

  // Get job by ID
  getJob(jobId: string): ImportJob | undefined {
    return this.jobs.get(jobId);
  }

  // Get all jobs (for monitoring)
  getAllJobs(): ImportJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Cancel a job
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'queued') {
      job.status = 'cancelled';
      const queueIndex = this.queue.indexOf(jobId);
      if (queueIndex !== -1) {
        this.queue.splice(queueIndex, 1);
      }
      this.emit('jobCancelled', job);
      return true;
    }

    return false;
  }

  // Update job progress
  updateProgress(jobId: string, current: number, total: number, stage: string, throughputRps?: number) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.progress = {
      current,
      total,
      stage,
      throughputRps,
      eta: throughputRps && total > current ? Math.ceil((total - current) / throughputRps) : undefined
    };

    this.emit('progressUpdate', job);
  }

  // Mark job as completed
  completeJob(jobId: string, result: ImportJob['result']) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'completed';
    job.result = result;
    job.completedAt = new Date();
    this.processing.delete(jobId);

    this.emit('jobCompleted', job);
    this.processQueue();
  }

  // Mark job as failed
  failJob(jobId: string, error: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'failed';
    job.error = error;
    job.completedAt = new Date();
    this.processing.delete(jobId);

    this.emit('jobFailed', job);
    this.processQueue();
  }

  // Start processing workers
  private startWorkers() {
    for (let i = 0; i < this.maxConcurrentJobs; i++) {
      this.workers.push(this.workerLoop());
    }
  }

  // Process the job queue
  private processQueue() {
    if (this.isShutdown) return;

    while (this.processing.size < this.maxConcurrentJobs && this.queue.length > 0) {
      const jobId = this.queue.shift()!;
      const job = this.jobs.get(jobId);
      
      if (job && job.status === 'queued') {
        job.status = 'processing';
        job.startedAt = new Date();
        this.processing.add(jobId);
        this.emit('jobStarted', job);
      }
    }
  }

  // Worker loop for processing jobs
  private async workerLoop(): Promise<void> {
    while (!this.isShutdown) {
      try {
        // Find a job to process
        const processingJob = Array.from(this.processing).find(jobId => {
          const job = this.jobs.get(jobId);
          return job?.status === 'processing';
        });

        if (processingJob) {
          const job = this.jobs.get(processingJob);
          if (job) {
            await this.processJob(job);
          }
        } else {
          // No jobs to process, wait a bit
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error('Worker error:', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // Process an individual job (will be implemented in worker.ts)
  private async processJob(job: ImportJob): Promise<void> {
    // This will be implemented by the ImportWorker
    this.emit('processJob', job);
  }

  // Clean up old completed jobs (run periodically)
  cleanup() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [jobId, job] of this.jobs.entries()) {
      if ((job.status === 'completed' || job.status === 'failed') && job.completedAt && job.completedAt < cutoff) {
        this.jobs.delete(jobId);
      }
    }
  }

  // Graceful shutdown
  async shutdown() {
    this.isShutdown = true;
    await Promise.all(this.workers);
  }
}

// Global job queue instance
export const jobQueue = new JobQueue();

// Cleanup job every hour
setInterval(() => {
  jobQueue.cleanup();
}, 60 * 60 * 1000);