import { AxiosError } from "axios";

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  multiplier: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2,
};

/**
 * Check if an error is retriable
 */
export function isRetriableError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return false;
  }

  const status = error.response?.status;

  // Network errors (no response)
  if (!status || error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return true;
  }

  // Server errors (5xx)
  if (status >= 500) {
    return true;
  }

  // Rate limit (429)
  if (status === 429) {
    return true;
  }

  // Request timeout (408)
  if (status === 408) {
    return true;
  }

  // Don't retry:
  // - Auth errors (401, 403)
  // - Validation errors (400, 422)
  // - Not found (404)
  // - Client errors (4xx)
  return false;
}

/**
 * Get delay before next retry attempt
 */
export function getRetryDelay(
  attempt: number,
  options: RetryOptions,
  error: unknown,
): number {
  // Check for Retry-After header
  if (error instanceof AxiosError && error.response?.headers) {
    const retryAfter = error.response.headers["retry-after"];
    if (retryAfter) {
      const parsed = parseInt(retryAfter, 10);
      if (!isNaN(parsed)) {
        return parsed * 1000; // Convert to ms
      }
    }
  }

  // Exponential backoff with jitter
  const delay = Math.min(
    options.initialDelay * Math.pow(options.multiplier, attempt),
    options.maxDelay,
  );

  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
}

/**
 * Retry an async operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if not retriable
      if (!isRetriableError(error)) {
        throw error;
      }

      // Don't retry if last attempt
      if (attempt === opts.maxRetries) {
        throw error;
      }

      // Calculate delay
      const delay = getRetryDelay(attempt, opts, error);

      // Call retry callback
      opts.onRetry?.(attempt + 1, lastError);

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
