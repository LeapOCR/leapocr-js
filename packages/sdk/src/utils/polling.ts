export interface PollOptions<T> {
  pollInterval: number;
  maxWait: number;
  signal?: AbortSignal;
  onProgress?: (value: T) => void;
}

export const DEFAULT_POLL_OPTIONS: Omit<PollOptions<any>, 'signal'> = {
  pollInterval: 2000,
  maxWait: 300000, // 5 minutes
};

/**
 * Poll an operation until a condition is met
 *
 * @param operation - Function to execute on each poll
 * @param condition - Function that returns true when polling should stop
 * @param options - Polling configuration
 * @returns The final value when condition is met
 * @throws TimeoutError if maxWait is exceeded
 * @throws Error if operation throws or signal is aborted
 */
export async function pollUntil<T>(
  operation: () => Promise<T>,
  condition: (value: T) => boolean,
  options: Partial<PollOptions<T>> = {}
): Promise<T> {
  const opts = { ...DEFAULT_POLL_OPTIONS, ...options };
  const startTime = Date.now();

  while (true) {
    // Check for cancellation
    if (opts.signal?.aborted) {
      throw new Error('Polling cancelled');
    }

    // Execute operation
    const value = await operation();

    // Call progress callback
    opts.onProgress?.(value);

    // Check condition
    if (condition(value)) {
      return value;
    }

    // Check timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= opts.maxWait) {
      throw new Error(`Polling timeout after ${opts.maxWait}ms`);
    }

    // Wait before next poll
    const remainingTime = opts.maxWait - elapsed;
    const delay = Math.min(opts.pollInterval, remainingTime);

    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
