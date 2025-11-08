import { readFileSync, statSync } from "fs";
import { basename } from "path";
import type { Readable } from "stream";
import type { ClientConfig } from "../types/config.js";
import type {
  UploadOptions,
  PollOptions,
  JobStatus,
  UploadResult,
  FileData,
  BatchOptions,
  BatchResult,
} from "../types/ocr.js";
import { getOcr } from "../generated/ocr/ocr.js";
import { validateFile, validateBuffer } from "../utils/validation.js";
import { withRetry } from "../utils/retry.js";
import { pollUntil } from "../utils/polling.js";
import { FileError, JobFailedError, TimeoutError } from "../errors/index.js";
import { DEFAULT_POLL_INTERVAL, DEFAULT_MAX_WAIT } from "../utils/constants.js";

/**
 * OCR Service for document processing
 */
export class OCRService {
  private readonly client = getOcr();

  constructor(private readonly config: Required<ClientConfig>) {}

  /**
   * Upload a file from local filesystem
   *
   * This initiates a multipart upload, uploads the file to presigned URL(s),
   * and completes the upload.
   */
  async uploadFile(
    filePath: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    // Validate file
    const validation = validateFile(filePath);
    if (!validation.valid) {
      throw new FileError(validation.error!, filePath);
    }

    // Get file stats and content
    const stats = statSync(filePath);
    const fileName = basename(filePath);
    const fileBuffer = readFileSync(filePath);

    return this.uploadFileBuffer(fileBuffer, fileName, options);
  }

  /**
   * Upload a file from Buffer
   *
   * This follows the multipart upload flow:
   * 1. Initiate upload (get presigned URLs)
   * 2. Upload file parts to S3
   * 3. Complete the upload
   */
  async uploadFileBuffer(
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
          model: options.model,
          ...(options.metadata && { metadata: options.metadata as any }),
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
    const uploadedParts = await this.uploadParts(buffer, parts);

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
   * Upload a file from Stream
   *
   * Note: Streams need to be converted to Buffer for multipart upload
   */
  async uploadFileStream(
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

    return this.uploadFileBuffer(buffer, fileName, options);
  }

  /**
   * Upload a file from URL
   */
  async uploadFromURL(
    url: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const response = await withRetry(
      () =>
        this.client.uploadFromRemoteURL({
          url,
          model: options.model,
          ...(options.metadata && { metadata: options.metadata as any }),
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
   * Get job status
   */
  async getJobStatus(jobId: string, signal?: AbortSignal): Promise<JobStatus> {
    const response = await withRetry(() => this.client.getJobStatus(jobId), {
      maxRetries: this.config.maxRetries,
      initialDelay: this.config.retryDelay,
      multiplier: this.config.retryMultiplier,
    });

    return this.mapJobStatus(response);
  }

  /**
   * Get job results
   */
  async getResults(
    jobId: string,
    options: { page?: number; limit?: number; signal?: AbortSignal } = {},
  ): Promise<any> {
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

    return response;
  }

  /**
   * Process file and wait for completion (convenience method)
   */
  async processFile(
    filePath: string,
    uploadOptions: UploadOptions = {},
    pollOptions: PollOptions = {},
  ): Promise<any> {
    // Upload file
    const uploadResult = await this.uploadFile(filePath, uploadOptions);

    // Poll until complete
    const result = await pollUntil(
      () => this.getJobStatus(uploadResult.jobId, pollOptions.signal),
      (status) => status.status === "completed" || status.status === "failed",
      {
        pollInterval: pollOptions.pollInterval || DEFAULT_POLL_INTERVAL,
        maxWait: pollOptions.maxWait || DEFAULT_MAX_WAIT,
        signal: pollOptions.signal,
        onProgress: pollOptions.onProgress,
      },
    ).catch((error) => {
      if (error.message?.includes("timeout")) {
        throw new TimeoutError(
          uploadResult.jobId,
          pollOptions.maxWait || DEFAULT_MAX_WAIT,
        );
      }
      throw error;
    });

    // Check if failed
    if (result.status === "failed") {
      throw new JobFailedError(uploadResult.jobId, result.error);
    }

    // Get results
    return this.getResults(uploadResult.jobId, { signal: pollOptions.signal });
  }

  /**
   * Process multiple files in batch
   */
  async processBatch(
    files: (string | FileData)[],
    options: BatchOptions = {},
  ): Promise<BatchResult> {
    const concurrency = options.concurrency || 5;
    const results: UploadResult[] = [];

    // Process in batches with concurrency limit
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const batchPromises = batch.map((file) => {
        if (typeof file === "string") {
          return this.uploadFile(file, options);
        } else {
          return this.uploadFileBuffer(file.data, file.fileName, options);
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      // Collect successful uploads
      batchResults.forEach((result) => {
        if (result.status === "fulfilled") {
          results.push(result.value);
        }
      });
    }

    return {
      jobs: results,
      totalFiles: files.length,
    };
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
