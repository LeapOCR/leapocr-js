import type { AxiosInstance } from 'axios';
import { createReadStream, statSync } from 'fs';
import { basename } from 'path';
import FormData from 'form-data';
import type { Readable } from 'stream';
import type { ClientConfig } from '../types/config.js';
import type {
  UploadOptions,
  PollOptions,
  JobStatus,
  UploadResult,
  FileData,
  BatchOptions,
  BatchResult,
} from '../types/ocr.js';
import { validateFile, validateBuffer } from '../utils/validation.js';
import { withRetry } from '../utils/retry.js';
import { pollUntil } from '../utils/polling.js';
import { FileError, JobFailedError, TimeoutError } from '../errors/index.js';
import { DEFAULT_POLL_INTERVAL, DEFAULT_MAX_WAIT } from '../utils/constants.js';

/**
 * OCR Service for document processing
 */
export class OCRService {
  constructor(
    private readonly httpClient: AxiosInstance,
    private readonly config: Required<Omit<ClientConfig, 'httpClient'>>
  ) {}

  /**
   * Upload a file from local filesystem
   */
  async uploadFile(
    filePath: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    // Validate file
    const validation = validateFile(filePath);
    if (!validation.valid) {
      throw new FileError(validation.error!, filePath);
    }

    // Get file name
    const fileName = basename(filePath);

    // Create form data
    const formData = new FormData();
    formData.append('file', createReadStream(filePath), fileName);

    // Add options
    if (options.model) {
      formData.append('model', options.model);
    }
    if (options.webhook) {
      formData.append('webhook', options.webhook);
    }
    if (options.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    // Upload with retry
    const response = await withRetry(
      () =>
        this.httpClient.post('/ocr/uploads/direct', formData, {
          headers: formData.getHeaders(),
          signal: options.signal,
        }),
      {
        maxRetries: this.config.maxRetries,
        initialDelay: this.config.retryDelay,
        multiplier: this.config.retryMultiplier,
      }
    );

    return this.mapUploadResponse(response.data);
  }

  /**
   * Upload a file from Buffer
   */
  async uploadFileBuffer(
    buffer: Buffer,
    fileName: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    // Validate buffer
    const validation = validateBuffer(buffer, fileName);
    if (!validation.valid) {
      throw new FileError(validation.error!, fileName, buffer.length);
    }

    // Create form data
    const formData = new FormData();
    formData.append('file', buffer, fileName);

    // Add options
    if (options.model) {
      formData.append('model', options.model);
    }
    if (options.webhook) {
      formData.append('webhook', options.webhook);
    }
    if (options.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    // Upload with retry
    const response = await withRetry(
      () =>
        this.httpClient.post('/ocr/uploads/direct', formData, {
          headers: formData.getHeaders(),
          signal: options.signal,
        }),
      {
        maxRetries: this.config.maxRetries,
        initialDelay: this.config.retryDelay,
        multiplier: this.config.retryMultiplier,
      }
    );

    return this.mapUploadResponse(response.data);
  }

  /**
   * Upload a file from Stream
   */
  async uploadFileStream(
    stream: Readable,
    fileName: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    // Create form data
    const formData = new FormData();
    formData.append('file', stream, fileName);

    // Add options
    if (options.model) {
      formData.append('model', options.model);
    }
    if (options.webhook) {
      formData.append('webhook', options.webhook);
    }
    if (options.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    // Upload with retry
    const response = await withRetry(
      () =>
        this.httpClient.post('/ocr/uploads/direct', formData, {
          headers: formData.getHeaders(),
          signal: options.signal,
        }),
      {
        maxRetries: this.config.maxRetries,
        initialDelay: this.config.retryDelay,
        multiplier: this.config.retryMultiplier,
      }
    );

    return this.mapUploadResponse(response.data);
  }

  /**
   * Upload a file from URL
   */
  async uploadFromURL(
    url: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const payload: any = {
      url,
    };

    if (options.model) {
      payload.model = options.model;
    }
    if (options.webhook) {
      payload.webhook = options.webhook;
    }
    if (options.metadata) {
      payload.metadata = options.metadata;
    }

    // Upload with retry
    const response = await withRetry(
      () =>
        this.httpClient.post('/ocr/uploads/url', payload, {
          signal: options.signal,
        }),
      {
        maxRetries: this.config.maxRetries,
        initialDelay: this.config.retryDelay,
        multiplier: this.config.retryMultiplier,
      }
    );

    return this.mapUploadResponse(response.data);
  }

  /**
   * Get job status
   */
  async getJobStatus(
    jobId: string,
    signal?: AbortSignal
  ): Promise<JobStatus> {
    const response = await withRetry(
      () =>
        this.httpClient.get(`/ocr/status/${jobId}`, {
          signal,
        }),
      {
        maxRetries: this.config.maxRetries,
        initialDelay: this.config.retryDelay,
        multiplier: this.config.retryMultiplier,
      }
    );

    return this.mapJobStatus(response.data);
  }

  /**
   * Get job results
   */
  async getResults(
    jobId: string,
    options: { page?: number; limit?: number; signal?: AbortSignal } = {}
  ): Promise<any> {
    const response = await withRetry(
      () =>
        this.httpClient.get(`/ocr/result/${jobId}`, {
          params: {
            page: options.page || 1,
            limit: options.limit || 100,
          },
          signal: options.signal,
        }),
      {
        maxRetries: this.config.maxRetries,
        initialDelay: this.config.retryDelay,
        multiplier: this.config.retryMultiplier,
      }
    );

    return response.data;
  }

  /**
   * Process file and wait for completion (convenience method)
   */
  async processFile(
    filePath: string,
    uploadOptions: UploadOptions = {},
    pollOptions: PollOptions = {}
  ): Promise<any> {
    // Upload file
    const uploadResult = await this.uploadFile(filePath, uploadOptions);

    // Poll until complete
    const result = await pollUntil(
      () => this.getJobStatus(uploadResult.jobId, pollOptions.signal),
      (status) => status.status === 'completed' || status.status === 'failed',
      {
        pollInterval: pollOptions.pollInterval || DEFAULT_POLL_INTERVAL,
        maxWait: pollOptions.maxWait || DEFAULT_MAX_WAIT,
        signal: pollOptions.signal,
        onProgress: pollOptions.onProgress,
      }
    ).catch((error) => {
      if (error.message?.includes('timeout')) {
        throw new TimeoutError(uploadResult.jobId, pollOptions.maxWait || DEFAULT_MAX_WAIT);
      }
      throw error;
    });

    // Check if failed
    if (result.status === 'failed') {
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
    options: BatchOptions = {}
  ): Promise<BatchResult> {
    const concurrency = options.concurrency || 5;
    const results: UploadResult[] = [];

    // Process in batches with concurrency limit
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const batchPromises = batch.map((file) => {
        if (typeof file === 'string') {
          return this.uploadFile(file, options);
        } else {
          return this.uploadFileBuffer(file.data, file.fileName, options);
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      // Collect successful uploads
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
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
   * Map upload response to UploadResult
   */
  private mapUploadResponse(data: any): UploadResult {
    return {
      jobId: data.job_id,
      status: data.status || 'pending',
      createdAt: data.created_at ? new Date(data.created_at) : new Date(),
      estimatedCompletion: data.estimated_completion
        ? new Date(data.estimated_completion)
        : undefined,
    };
  }

  /**
   * Map job status response
   */
  private mapJobStatus(data: any): JobStatus {
    return {
      jobId: data.job_id,
      status: data.status,
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
