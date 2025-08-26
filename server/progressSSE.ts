// Server-Sent Events for real-time import progress updates
import { Request, Response } from 'express';
import { jobQueue } from './jobQueue';

interface SSEConnection {
  jobId: string;
  response: Response;
  lastEventId?: string;
}

class ProgressSSEManager {
  private connections = new Map<string, SSEConnection[]>();

  constructor() {
    this.setupEventListeners();
  }

  // Set up event listeners for job progress updates
  private setupEventListeners() {
    jobQueue.on('jobAdded', (job) => {
      this.broadcastProgress(job.id, {
        status: job.status,
        progress: job.progress,
        message: 'Job added to queue'
      });
    });

    jobQueue.on('jobStarted', (job) => {
      this.broadcastProgress(job.id, {
        status: job.status,
        progress: job.progress,
        message: 'Import started'
      });
    });

    jobQueue.on('progressUpdate', (job) => {
      this.broadcastProgress(job.id, {
        status: job.status,
        progress: job.progress,
        message: job.progress.stage
      });
    });

    jobQueue.on('jobCompleted', (job) => {
      this.broadcastProgress(job.id, {
        status: job.status,
        progress: job.progress,
        result: job.result,
        message: 'Import completed successfully'
      });
      
      // Close connections for completed jobs after a delay
      setTimeout(() => {
        this.closeConnections(job.id);
      }, 5000);
    });

    jobQueue.on('jobFailed', (job) => {
      this.broadcastProgress(job.id, {
        status: job.status,
        progress: job.progress,
        error: job.error,
        message: 'Import failed'
      });
      
      // Close connections for failed jobs after a delay
      setTimeout(() => {
        this.closeConnections(job.id);
      }, 10000);
    });

    jobQueue.on('jobCancelled', (job) => {
      this.broadcastProgress(job.id, {
        status: job.status,
        progress: job.progress,
        message: 'Import cancelled'
      });
      
      this.closeConnections(job.id);
    });
  }

  // Handle SSE connection for job progress
  handleSSEConnection(req: Request, res: Response, jobId: string) {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no' // Disable Nginx buffering
    });

    // Send initial connection message
    this.sendSSEMessage(res, {
      type: 'connected',
      message: 'Connected to progress stream'
    });

    // Store connection
    const connection: SSEConnection = {
      jobId,
      response: res,
      lastEventId: req.headers['last-event-id'] as string
    };

    if (!this.connections.has(jobId)) {
      this.connections.set(jobId, []);
    }
    this.connections.get(jobId)!.push(connection);

    // Send current job status if available
    const job = jobQueue.getJob(jobId);
    if (job) {
      this.sendSSEMessage(res, {
        type: 'status',
        data: {
          status: job.status,
          progress: job.progress,
          result: job.result,
          error: job.error
        }
      });
    }

    // Handle client disconnect
    req.on('close', () => {
      this.removeConnection(jobId, connection);
    });

    req.on('aborted', () => {
      this.removeConnection(jobId, connection);
    });

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(heartbeat);
        return;
      }
      
      this.sendSSEMessage(res, {
        type: 'heartbeat',
        message: 'ping'
      });
    }, 30000); // Every 30 seconds

    req.on('close', () => {
      clearInterval(heartbeat);
    });
  }

  // Broadcast progress update to all connections for a job
  private broadcastProgress(jobId: string, data: any) {
    const connections = this.connections.get(jobId);
    if (!connections) return;

    connections.forEach(connection => {
      if (!connection.response.writableEnded) {
        this.sendSSEMessage(connection.response, {
          type: 'progress',
          data
        });
      }
    });
  }

  // Send SSE message to a specific response
  private sendSSEMessage(res: Response, message: { type: string; data?: any; message?: string }) {
    try {
      if (res.writableEnded) return;

      const eventId = Date.now().toString();
      const data = JSON.stringify(message);

      res.write(`id: ${eventId}\n`);
      res.write(`event: ${message.type}\n`);
      res.write(`data: ${data}\n\n`);
    } catch (error) {
      console.error('SSE send error:', error);
    }
  }

  // Remove a specific connection
  private removeConnection(jobId: string, connection: SSEConnection) {
    const connections = this.connections.get(jobId);
    if (!connections) return;

    const index = connections.indexOf(connection);
    if (index !== -1) {
      connections.splice(index, 1);
    }

    if (connections.length === 0) {
      this.connections.delete(jobId);
    }
  }

  // Close all connections for a job
  private closeConnections(jobId: string) {
    const connections = this.connections.get(jobId);
    if (!connections) return;

    connections.forEach(connection => {
      try {
        if (!connection.response.writableEnded) {
          this.sendSSEMessage(connection.response, {
            type: 'close',
            message: 'Stream closed'
          });
          connection.response.end();
        }
      } catch (error) {
        console.error('Error closing SSE connection:', error);
      }
    });

    this.connections.delete(jobId);
  }

  // Get connection count for monitoring
  getConnectionCount(): number {
    let count = 0;
    for (const connections of this.connections.values()) {
      count += connections.length;
    }
    return count;
  }

  // Get connection count for a specific job
  getJobConnectionCount(jobId: string): number {
    return this.connections.get(jobId)?.length || 0;
  }
}

// Global SSE manager instance
export const progressSSE = new ProgressSSEManager();