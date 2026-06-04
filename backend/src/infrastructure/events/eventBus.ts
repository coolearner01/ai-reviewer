import { EventEmitter } from 'node:events';
import type { ReviewProgressEvent } from '../../types';

/**
 * In-process pub/sub used to stream review progress to SSE clients.
 *
 * Originally the spec called for Redis pub/sub so multiple API instances could
 * share events. We use a single-process EventEmitter instead — perfect for the
 * initial build where one Node process runs the API and the job runner.
 *
 * If you ever scale horizontally, swap the implementation behind this same
 * interface for Redis pub/sub or NATS — no other file needs to change.
 */
class ReviewEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Reviews can have many concurrent SSE subscribers — lift the cap.
    this.emitter.setMaxListeners(200);
  }

  private channel(reviewId: string) {
    return `review:${reviewId}:progress`;
  }

  publish(reviewId: string, event: ReviewProgressEvent): void {
    this.emitter.emit(this.channel(reviewId), event);
  }

  subscribe(reviewId: string, listener: (event: ReviewProgressEvent) => void): () => void {
    const ch = this.channel(reviewId);
    this.emitter.on(ch, listener);
    return () => this.emitter.off(ch, listener);
  }
}

export const reviewEventBus = new ReviewEventBus();
