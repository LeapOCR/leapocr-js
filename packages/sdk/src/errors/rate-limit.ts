import { SDKError } from './base.js';

/**
 * Error thrown when rate limit is exceeded (429)
 */
export class RateLimitError extends SDKError {
  constructor(
    message: string,
    public retryAfter?: number // seconds
  ) {
    super(message, 'RATE_LIMIT_ERROR', 429);
  }
}
