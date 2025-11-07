/**
 * OCR-related type definitions
 */

/**
 * Upload options
 */
export interface UploadOptions {
  /** OCR model to use */
  model?: 'standard-v1' | 'apex-v1' | 'genesis-v1';

  /** Webhook URL for job completion notifications */
  webhook?: string;

  /** Custom metadata (string values only) */
  metadata?: Record<string, string>;

  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Polling options
 */
export interface PollOptions {
  /** Polling interval in ms. Default: 2000 */
  pollInterval?: number;

  /** Maximum wait time in ms. Default: 300000 (5min) */
  maxWait?: number;

  /** Progress callback */
  onProgress?: (status: JobStatus) => void;

  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Job status type
 */
export type JobStatusType = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Job status response
 */
export interface JobStatus {
  jobId: string;
  status: JobStatusType;
  progress?: number; // 0-100
  estimatedCompletion?: Date;
  error?: { code: string; message: string };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Upload result
 */
export interface UploadResult {
  jobId: string;
  status: 'pending' | 'processing';
  createdAt: Date;
  estimatedCompletion?: Date;
}

/**
 * Pagination info
 */
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalResults: number;
  hasNext: boolean;
}

/**
 * Result metadata
 */
export interface ResultMetadata {
  fileName: string;
  fileSize: number;
  totalPages: number;
  model: string;
  processingTime: number; // milliseconds
}

/**
 * File data for batch processing
 */
export interface FileData {
  data: Buffer;
  fileName: string;
}

/**
 * Batch processing options
 */
export interface BatchOptions extends UploadOptions {
  /** Maximum concurrent uploads. Default: 5 */
  concurrency?: number;
}

/**
 * Batch result
 */
export interface BatchResult {
  jobs: UploadResult[];
  totalFiles: number;
}
