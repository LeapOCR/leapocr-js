import { SDKError } from './base.js';

/**
 * Base error for job-related errors
 */
export class JobError extends SDKError {
  constructor(
    message: string,
    public jobId: string,
    code: string = 'JOB_ERROR',
    statusCode?: number
  ) {
    super(message, code, statusCode);
  }
}

/**
 * Error thrown when a job processing fails
 */
export class JobFailedError extends JobError {
  constructor(
    jobId: string,
    public jobError?: { code: string; message: string }
  ) {
    super(
      `Job ${jobId} failed: ${jobError?.message || 'Unknown error'}`,
      jobId,
      'JOB_FAILED'
    );
  }
}

/**
 * Error thrown when polling times out
 */
export class TimeoutError extends JobError {
  constructor(
    jobId: string,
    public timeoutMs: number
  ) {
    super(`Job ${jobId} timed out after ${timeoutMs}ms`, jobId, 'TIMEOUT_ERROR');
  }
}
