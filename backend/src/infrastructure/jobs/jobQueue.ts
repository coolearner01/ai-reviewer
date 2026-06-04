import { randomUUID } from 'node:crypto';
import { config } from '../../config';
import { logger } from '../../utils/logger';

type Handler<Payload> = (payload: Payload, jobId: string) => Promise<void>;

interface QueuedJob {
  id: string;
  name: string;
  payload: unknown;
  attempt: number;
}

class JobQueue {
  private readonly handlers = new Map<string, Handler<unknown>>();
  private readonly waiting: QueuedJob[] = [];
  private running = 0;
  private readonly concurrency: number;
  private readonly maxAttempts: number;

  constructor(concurrency: number, maxAttempts: number) {
    this.concurrency = Math.max(1, concurrency);
    this.maxAttempts = Math.max(1, maxAttempts);
  }

  /** Register a handler. Must be called BEFORE enqueueing jobs of this name. */
  register<Payload>(name: string, handler: Handler<Payload>): void {
    if (this.handlers.has(name)) {
      throw new Error(`Job handler already registered for "${name}"`);
    }
    this.handlers.set(name, handler as Handler<unknown>);
  }

  /** Enqueue a job. Returns the job id immediately — the work runs in the background. */
  enqueue<Payload>(name: string, payload: Payload): string {
    if (!this.handlers.has(name)) {
      // Help the developer catch typos early.
      throw new Error(`No handler registered for job "${name}"`);
    }
    const job: QueuedJob = { id: randomUUID(), name, payload, attempt: 1 };
    this.waiting.push(job);
    logger.info('[job] enqueued', { jobId: job.id, name });
    setImmediate(() => this.drain());
    return job.id;
  }

  private drain(): void {
    while (this.running < this.concurrency && this.waiting.length > 0) {
      const job = this.waiting.shift()!;
      this.run(job);
    }
  }

  private run(job: QueuedJob): void {
    const handler = this.handlers.get(job.name);
    if (!handler) {
      logger.error('[job] missing handler at run-time', { jobId: job.id, name: job.name });
      return;
    }
    this.running++;
    const startedAt = Date.now();
    handler(job.payload, job.id)
      .then(() => {
        logger.info('[job] completed', {
          jobId: job.id,
          name: job.name,
          attempt: job.attempt,
          durationMs: Date.now() - startedAt,
        });
      })
      .catch((err: unknown) => {
        // Critical: handlers must do their own DB cleanup. We only log here.
        const message = err instanceof Error ? err.message : String(err);
        logger.error('[job] failed', {
          jobId: job.id,
          name: job.name,
          attempt: job.attempt,
          maxAttempts: this.maxAttempts,
          error: message,
        });
        // Re-queue with exponential backoff: 5s, 15s, 45s, 135s, ...
        if (job.attempt < this.maxAttempts) {
          const delayMs = Math.min(60_000 * 5, 5_000 * Math.pow(3, job.attempt - 1));
          const retryJob: QueuedJob = { ...job, attempt: job.attempt + 1 };
          logger.info('[job] scheduling retry', {
            jobId: job.id,
            nextAttempt: retryJob.attempt,
            delayMs,
          });
          setTimeout(() => {
            this.waiting.push(retryJob);
            setImmediate(() => this.drain());
          }, delayMs).unref();
        }
      })
      .finally(() => {
        this.running--;
        setImmediate(() => this.drain());
      });
  }

  /** Stats for /health endpoint */
  stats() {
    return {
      running: this.running,
      waiting: this.waiting.length,
      concurrency: this.concurrency,
      maxAttempts: this.maxAttempts,
    };
  }
}

export const jobQueue = new JobQueue(config.JOB_CONCURRENCY, config.JOB_MAX_ATTEMPTS);

// Names are exported as constants so we never typo a job name at a call site.
export const JOB_NAMES = {
  RUN_REVIEW: 'run-review',
} as const;

export interface RunReviewPayload {
  reviewId: string;
}
