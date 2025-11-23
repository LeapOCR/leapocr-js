import { readFileSync } from "fs";
import { basename } from "path";
import type { Readable } from "stream";
import { FileError, TimeoutError } from "../errors/index.js";
import { getJobs } from "../generated/jobs/jobs.js";
import { getOcr } from "../generated/ocr/ocr.js";
import type { ClientConfig } from "../types/config.js";
import type {
  JobStatus,
  OCRJobResult,
  PollOptions,
  UploadOptions,
  UploadResult,
} from "../types/ocr.js";
import { DEFAULT_MAX_WAIT, DEFAULT_POLL_INTERVAL } from "../utils/constants.js";
import { pollUntil } from "../utils/polling.js";
import { withRetry } from "../utils/retry.js";
import { validateBuffer, validateFile } from "../utils/validation.js";

/**
 * OCR Service for document processing operations.
 *
 * Handles document upload, job management, and result retrieval for OCR operations.
 * Supports multiple upload methods (file, buffer, stream, URL) and provides
 * convenient methods for job polling and batch processing.
 *
 * @example
 * ```typescript
 * const client = new LeapOCR({ apiKey: 'your-key' });
 *
 * // Upload and process a file
 * const result = await client.ocr.processFile('./invoice.pdf', {
 *   format: 'structured',
 *   model: 'pro-v1',
 *   instructions: 'Extract invoice details',
 * });
 * ```
 */
export class OCRService {
  private readonly client = getOcr();
  private readonly jobsClient = getJobs();

  constructor(private readonly config: Required<ClientConfig>) {}

  /**
   * Process a PDF file from the local filesystem.
   *
   * This method:
   * 1. Validates the file (extension, size, existence)
   * 2. Initiates a multipart upload to get presigned URL(s)
   * 3. Uploads the file directly to S3
   * 4. Completes the upload and starts OCR processing
   *
   * **Supported formats:** PDF only (currently)
   * **Maximum file size:** 100MB
   *
   * @param filePath - Absolute or relative path to the PDF file
   * @param options - Processing configuration options
   * @param options.format - Output format: `markdown` (page-by-page OCR), `structured` (data extraction), or `per_page_structured`
   * @param options.model - OCR model: `standard-v1` (1 credit/page), `english-pro-v1` (2 credits/page), or `pro-v1` (5 credits/page)
   * @param options.instructions - Instructions for structured extraction (max 100 chars)
   * @param options.schema - JSON schema for structured data extraction
   * @param options.templateSlug - Template slug for reusable extraction schemas
   * @returns Job information with job ID and initial status
   * @throws {FileError} If file doesn't exist, is too large, or is not a PDF
   * @throws {ValidationError} If request parameters are invalid
   * @throws {AuthenticationError} If API key is invalid
   * @throws {NetworkError} If upload fails due to network issues
   *
   * @example
   * ```typescript
   * // Basic processing
   * const job = await client.ocr.processFile('./document.pdf');
   *
   * // With structured extraction
   * const job = await client.ocr.processFile('./invoice.pdf', {
   *   format: 'structured',
   *   model: 'pro-v1',
   *   instructions: 'Extract invoice number, date, and total amount',
   * });
   * ```
   */
  async processFile(
    filePath: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    // Validate file
    const validation = validateFile(filePath);
    if (!validation.valid) {
      throw new FileError(validation.error!, filePath);
    }

    // Get file content
    const fileName = basename(filePath);
    const fileBuffer = readFileSync(filePath);

    return this.processFileBuffer(fileBuffer, fileName, options);
  }

  /**
   * Process a file from Buffer
   *
   * This follows the multipart upload flow:
   * 1. Initiate upload (get presigned URLs)
   * 2. Upload file parts to S3
   * 3. Complete the upload
   */
  async processFileBuffer(
    buffer: Buffer,
    fileName: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    // Validate buffer
    const validation = validateBuffer(buffer, fileName);
    if (!validation.valid) {
      throw new FileError(validation.error!, fileName, buffer.length);
    }

    // Step 1: Initiate direct upload
    const initiateResponse = await withRetry(
      () =>
        this.client.directUpload({
          file_name: fileName,
          file_size: buffer.length,
          content_type: this.getContentType(fileName),
          ...(options.model && { model: options.model }),
          ...(options.format && { format: options.format }),
          ...(options.instructions && { instructions: options.instructions }),
          ...(options.schema && { schema: options.schema as any }),
          ...(options.templateSlug && { template_slug: options.templateSlug }),
        }),
      {
        maxRetries: this.config.maxRetries,
        initialDelay: this.config.retryDelay,
        multiplier: this.config.retryMultiplier,
      },
    );

    const { job_id, parts, upload_type } = initiateResponse;

    if (!job_id || !parts) {
      throw new Error("Invalid upload response");
    }

    // Step 2: Upload to presigned URLs
    // Filter out parts that don't have required fields
    const validParts = parts.filter(
      (part): part is { part_number: number; upload_url: string } =>
        typeof part.part_number === "number" &&
        typeof part.upload_url === "string",
    );

    if (validParts.length === 0) {
      throw new Error("No valid upload parts in response");
    }

    const uploadedParts = await this.uploadParts(buffer, validParts);

    // Step 3: Complete the upload
    if (upload_type === "multipart" && uploadedParts.length > 0) {
      await withRetry(
        () =>
          this.client.completeDirectUpload(job_id, {
            parts: uploadedParts,
          }),
        {
          maxRetries: this.config.maxRetries,
          initialDelay: this.config.retryDelay,
          multiplier: this.config.retryMultiplier,
        },
      );
    }

    return {
      jobId: job_id,
      status: "pending",
      createdAt: new Date(),
    };
  }

  /**
   * Upload file parts to S3 presigned URLs
   */
  private async uploadParts(
    buffer: Buffer,
    parts: Array<{ part_number: number; upload_url: string }>,
  ): Promise<Array<{ part_number: number; etag: string }>> {
    const uploadedParts: Array<{ part_number: number; etag: string }> = [];

    for (const part of parts) {
      const { part_number, upload_url } = part;

      // Calculate byte range for this part
      const chunkSize = Math.ceil(buffer.length / parts.length);
      const start = (part_number - 1) * chunkSize;
      const end = Math.min(start + chunkSize, buffer.length);
      const chunk = buffer.slice(start, end);

      // Upload to S3
      const response = await fetch(upload_url, {
        method: "PUT",
        body: chunk,
        headers: {
          "Content-Type": "application/octet-stream",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to upload part ${part_number}: ${response.statusText}`,
        );
      }

      const etag = response.headers.get("ETag");
      if (!etag) {
        throw new Error(`No ETag returned for part ${part_number}`);
      }

      uploadedParts.push({
        part_number,
        etag: etag.replace(/"/g, ""), // Remove quotes from ETag
      });
    }

    return uploadedParts;
  }

  /**
   * Get content type from file name
   */
  private getContentType(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      tiff: "image/tiff",
      tif: "image/tiff",
      webp: "image/webp",
    };
    return contentTypes[ext || ""] || "application/octet-stream";
  }

  /**
   * Process a file from Stream
   *
   * Note: Streams need to be converted to Buffer for multipart upload
   */
  async processFileStream(
    stream: Readable,
    fileName: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    return this.processFileBuffer(buffer, fileName, options);
  }

  /**
   * Process a PDF file from a remote URL.
   *
   * The LeapOCR API will fetch the file from the provided URL and process it.
   * The URL must be publicly accessible from the API servers.
   *
   * @param url - Public URL of the PDF document to process (must be accessible via HTTP/HTTPS)
   * @param options - Processing configuration options
   * @param options.format - Output format: `markdown` (page-by-page OCR), `structured` (data extraction), or `per_page_structured`
   * @param options.model - OCR model: `standard-v1` (1 credit/page), `english-pro-v1` (2 credits/page), or `pro-v1` (5 credits/page)
   * @param options.instructions - Instructions for structured extraction (max 100 chars)
   * @param options.schema - JSON schema for structured data extraction
   * @param options.templateSlug - Template slug for reusable extraction schemas
   * @returns Job information with job ID and initial status
   * @throws {ValidationError} If URL is invalid or request parameters are invalid
   * @throws {AuthenticationError} If API key is invalid
   * @throws {NetworkError} If the API cannot fetch the URL
   *
   * @example
   * ```typescript
   * const job = await client.ocr.processURL(
   *   'https://example.com/invoice.pdf',
   *   {
   *     format: 'structured',
   *     model: 'standard-v1',
   *     instructions: 'Extract invoice number, date, and total amount',
   *   }
   * );
   * ```
   */
  async processURL(
    url: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const response = await withRetry(
      () =>
        this.client.uploadFromRemoteURL({
          url,
          ...(options.model && { model: options.model }),
          ...(options.format && { format: options.format }),
          ...(options.instructions && { instructions: options.instructions }),
          ...(options.schema && { schema: options.schema as any }),
          ...(options.templateSlug && { template_slug: options.templateSlug }),
        }),
      {
        maxRetries: this.config.maxRetries,
        initialDelay: this.config.retryDelay,
        multiplier: this.config.retryMultiplier,
      },
    );

    return {
      jobId: response.job_id || "",
      status: "pending",
      createdAt: new Date(),
    };
  }

  /**
   * Retrieve the current processing status and progress of an OCR job.
   *
   * Use this to check job status, monitor progress, and detect completion or errors.
   * Status will be one of: `pending`, `processing`, `completed`, or `failed`.
   *
   * @param jobId - The unique job identifier (UUID format)
   * @param signal - Optional AbortSignal to cancel the request
   * @returns Job status including progress percentage and estimated completion time
   * @throws {ValidationError} If job ID format is invalid
   * @throws {AuthenticationError} If API key is invalid
   * @throws {AuthorizationError} If job belongs to a different user
   * @throws {APIError} If job is not found (404) or other API errors occur
   *
   * @example
   * ```typescript
   * const status = await client.ocr.getJobStatus(jobId);
   *
   * console.log(`Status: ${status.status}`);
   * if (status.progress) {
   *   console.log(`Progress: ${status.progress}%`);
   * }
   * if (status.status === 'completed') {
   *   // Fetch results
   *   const result = await client.ocr.getJobResult(jobId);
   * }
   * ```
   */
  async getJobStatus(jobId: string, _signal?: AbortSignal): Promise<JobStatus> {
    const response = await withRetry(() => this.client.getJobStatus(jobId), {
      maxRetries: this.config.maxRetries,
      initialDelay: this.config.retryDelay,
      multiplier: this.config.retryMultiplier,
    });

    return this.mapJobStatus(response);
  }

  /**
   * Wait for job completion by repeatedly polling the job status.
   *
   * This method will poll the job status at regular intervals until the job
   * reaches a terminal state (`completed` or `failed`) or the maximum wait
   * time is exceeded.
   *
   * @param jobId - The unique job identifier (UUID format)
   * @param options - Polling configuration options
   * @param options.pollInterval - Time between status checks in milliseconds (default: 2000ms)
   * @param options.maxWait - Maximum time to wait in milliseconds (default: 300000ms / 5 minutes)
   * @param options.onProgress - Callback function called on each status update
   * @param options.signal - Optional AbortSignal to cancel polling
   * @returns Final job status (either `completed` or `failed`)
   * @throws {TimeoutError} If job doesn't complete within maxWait period
   * @throws {Error} If AbortSignal is triggered
   *
   * @example
   * ```typescript
   * // Basic usage
   * const result = await client.ocr.waitUntilDone(job.jobId);
   *
   * // With progress tracking
   * const result = await client.ocr.waitUntilDone(job.jobId, {
   *   pollInterval: 2000,
   *   maxWait: 600000, // 10 minutes
   *   onProgress: (status) => {
   *     console.log(`${status.status}: ${status.progress}%`);
   *   },
   * });
   *
   * // With cancellation
   * const controller = new AbortController();
   * setTimeout(() => controller.abort(), 30000); // Cancel after 30s
   *
   * const result = await client.ocr.waitUntilDone(job.jobId, {
   *   signal: controller.signal,
   * });
   * ```
   */
  async waitUntilDone(
    jobId: string,
    options: PollOptions = {},
  ): Promise<JobStatus> {
    const result = await pollUntil(
      () => this.getJobStatus(jobId, options.signal),
      (status) => status.status === "completed" || status.status === "failed",
      {
        pollInterval: options.pollInterval || DEFAULT_POLL_INTERVAL,
        maxWait: options.maxWait || DEFAULT_MAX_WAIT,
        signal: options.signal,
        onProgress: options.onProgress,
      },
    ).catch((error) => {
      if (error.message?.includes("timeout")) {
        throw new TimeoutError(jobId, options.maxWait || DEFAULT_MAX_WAIT);
      }
      throw error;
    });

    return result;
  }

  /**
   * Get job result (alias for getResults with different signature for compatibility)
   *
   * Returns page results where each page.result is either:
   * - `string` for markdown format
   * - `Record<string, any>` for structured/per_page_structured formats
   *
   * @example
   * ```typescript
   * const result = await client.ocr.getJobResult(jobId);
   *
   * // For markdown format
   * const text = result.pages?.[0]?.result as string;
   *
   * // For structured format - cast to your interface
   * interface InvoiceData {
   *   invoice_number: string;
   *   total: number;
   * }
   * const data = result.pages?.[0]?.result as InvoiceData;
   * ```
   */
  async getJobResult(
    jobId: string,
    options: { page?: number; pageSize?: number; signal?: AbortSignal } = {},
  ): Promise<OCRJobResult> {
    const response = await withRetry(
      () =>
        this.client.getJobResult(jobId, {
          page: options.page || 1,
          limit: options.pageSize || 100,
        }),
      {
        maxRetries: this.config.maxRetries,
        initialDelay: this.config.retryDelay,
        multiplier: this.config.retryMultiplier,
      },
    );

    return response as OCRJobResult;
  }

  /**
   * Get job results
   */
  async getResults(
    jobId: string,
    options: { page?: number; limit?: number; signal?: AbortSignal } = {},
  ): Promise<OCRJobResult> {
    const response = await withRetry(
      () =>
        this.client.getJobResult(jobId, {
          page: options.page || 1,
          limit: options.limit || 100,
        }),
      {
        maxRetries: this.config.maxRetries,
        initialDelay: this.config.retryDelay,
        multiplier: this.config.retryMultiplier,
      },
    );

    return response as OCRJobResult;
  }

  /**
   * Delete an OCR job.
   *
   * Permanently deletes a job and all associated data including uploaded files,
   * processing results, and metadata. This operation cannot be undone.
   *
   * @param jobId - The unique job identifier (UUID format)
   * @returns Confirmation of deletion
   * @throws {ValidationError} If job ID format is invalid
   * @throws {AuthenticationError} If API key is invalid
   * @throws {AuthorizationError} If job belongs to a different user
   * @throws {APIError} If job is not found (404) or other API errors occur
   *
   * @example
   * ```typescript
   * await client.ocr.deleteJob(jobId);
   * console.log('Job deleted successfully');
   * ```
   */
  async deleteJob(jobId: string): Promise<void> {
    await withRetry(() => this.jobsClient.deleteJob(jobId, {}), {
      maxRetries: this.config.maxRetries,
      initialDelay: this.config.retryDelay,
      multiplier: this.config.retryMultiplier,
    });
  }

  /**
   * Map job status response
   */
  private mapJobStatus(data: any): JobStatus {
    return {
      jobId: data.job_id || data.id || "",
      status: data.status || "pending",
      progress: data.progress,
      estimatedCompletion: data.estimated_completion
        ? new Date(data.estimated_completion)
        : undefined,
      error: data.error,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(),
      updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
    };
  }
}
