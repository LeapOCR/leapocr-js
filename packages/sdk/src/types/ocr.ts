/**
 * OCR-related type definitions for the LeapOCR SDK.
 *
 * @packageDocumentation
 */

/**
 * Available OCR models with their characteristics and credit costs.
 *
 * Each model has different accuracy levels and credit costs per page:
 * - **standard-v1**: Baseline model suitable for most documents (1 credit/page)
 * - **english-pro-v1**: Enhanced accuracy for English-only documents (2 credits/page)
 * - **pro-v1**: Highest quality model for complex layouts and critical accuracy needs (5 credits/page)
 *
 * The type also accepts custom strings for future models while providing
 * autocomplete suggestions for known models.
 *
 * @example
 * ```typescript
 * // Known models get autocomplete
 * const model: OCRModel = 'standard-v1';
 *
 * // Custom models are also accepted
 * const futureModel: OCRModel = 'experimental-v2';
 * ```
 */
export type OCRModel =
  | "standard-v1" // Baseline model, handles all cases (1 credit/page)
  | "english-pro-v1" // Premium quality, English documents only (2 credits/page)
  | "pro-v1" // Highest quality, handles all cases (5 credits/page)
  | (string & {}); // Allow any string while preserving autocomplete

/**
 * Result format types
 */
export type ResultFormat = "markdown" | "structured" | "per_page_structured";

/**
 * Configuration options for uploading and processing documents.
 *
 * @example
 * ```typescript
 * const options: UploadOptions = {
 *   format: 'structured',
 *   model: 'pro-v1',
 *   instructions: 'Extract invoice details',
 *   schema: {
 *     type: 'object',
 *     properties: {
 *       invoice_number: { type: 'string' },
 *       total: { type: 'number' },
 *     },
 *   },
 * };
 * ```
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
  format?: ResultFormat;

  /** Instructions for structured extraction (max 100 chars) */
  instructions?: string;

  /** Schema for structured data extraction */
  schema?: Record<string, unknown>;

  /** Template slug for using existing template */
  templateSlug?: string;

  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Configuration options for polling job status until completion.
 *
 * Controls how frequently to check job status and how long to wait before timing out.
 *
 * @example
 * ```typescript
 * const pollOptions: PollOptions = {
 *   pollInterval: 2000,  // Check every 2 seconds
 *   maxWait: 600000,     // Wait up to 10 minutes
 *   onProgress: (status) => {
 *     console.log(`Progress: ${status.progress}%`);
 *   },
 * };
 * ```
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
 * Page result type - varies based on result format
 * - `string` for markdown format
 * - `Record<string, any>` for structured/per_page_structured formats
 */
export interface PageResult {
  id?: string;
  page_number?: number;
  result?: string | Record<string, any>;
}

/**
 * OCR Job Result Response
 */
export interface OCRJobResult {
  completed_at?: string;
  credits_used?: number;
  file_name?: string;
  job_id?: string;
  model?: string;
  pages?: PageResult[];
  pagination?: {
    current_page?: number;
    page_size?: number;
    total_pages?: number;
    total_results?: number;
  };
  processed_pages?: number;
  result_format?: string;
  status?: string;
  total_pages?: number;
}
