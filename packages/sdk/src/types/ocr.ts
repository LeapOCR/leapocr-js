/**
 * OCR-related type definitions
 */

/**
 * Available OCR models
 */
export type OCRModel =
  | "standard-v1" // Baseline model, handles all cases (1 credit/page)
  | "english-pro-v1" // Premium quality, English documents only (2 credits/page)
  | "pro-v1" // Highest quality, handles all cases (5 credits/page)
  | (string & {}); // Allow any string while preserving autocomplete

/**
 * Upload options
 */
export interface UploadOptions {
  /**
   * OCR model to use
   *
   * Available models:
   * - `standard-v1`: Baseline model, handles all cases (1 credit/page)
   * - `english-pro-v1`: Premium quality, English documents only (2 credits/page)
   * - `pro-v1`: Highest quality, handles all cases (5 credits/page)
   */
  model?: OCRModel;

  /** Output format: markdown (page-by-page OCR), structured (data extraction), or per_page_structured */
  format?: "markdown" | "structured" | "per_page_structured";

  /** Instructions for structured extraction (max 100 chars) */
  instructions?: string;

  /** Schema for structured data extraction */
  schema?: Record<string, unknown>;

  /** Template ID for using existing template */
  templateId?: string;

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
export type JobStatusType = "pending" | "processing" | "completed" | "failed";

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
  status: "pending" | "processing";
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
