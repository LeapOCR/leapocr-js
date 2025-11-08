import type { ClientConfig } from './types/config.js';
import { OCRService } from './services/ocr.js';
import { AXIOS_INSTANCE } from './lib/custom-instance.js';
import {
  SDKError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ValidationError,
  APIError,
  NetworkError,
} from './errors/index.js';
import { SDK_VERSION } from './utils/constants.js';
import type { AxiosError } from 'axios';

const DEFAULT_BASE_URL = 'https://api.leapocr.com/api/v1';
const DEFAULT_TIMEOUT = 30000;

/**
 * Main LeapOCR SDK client
 */
export class LeapOCR {
  private readonly config: Required<ClientConfig>;
  private _ocr?: OCRService;

  constructor(
    private readonly apiKey: string,
    config: ClientConfig = {}
  ) {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    this.config = {
      baseURL: config.baseURL ?? DEFAULT_BASE_URL,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      retryMultiplier: config.retryMultiplier ?? 2,
      debug: config.debug ?? false,
    };

    // Configure the global Axios instance
    AXIOS_INSTANCE.defaults.baseURL = this.config.baseURL;
    AXIOS_INSTANCE.defaults.timeout = this.config.timeout;
    AXIOS_INSTANCE.defaults.headers.common['X-API-KEY'] = apiKey;
    AXIOS_INSTANCE.defaults.headers.common['User-Agent'] = `leapocr-sdk-js/${SDK_VERSION}`;

    // Setup interceptors
    this.setupInterceptors();
  }

  /**
   * Setup request/response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor for debugging
    if (this.config.debug) {
      AXIOS_INSTANCE.interceptors.request.use(
        (config) => {
          console.log('[LeapOCR] Request:', {
            method: config.method?.toUpperCase(),
            url: config.url,
            params: config.params,
          });
          return config;
        },
        (error) => {
          console.error('[LeapOCR] Request Error:', error);
          return Promise.reject(error);
        }
      );
    }

    // Response interceptor for error handling
    AXIOS_INSTANCE.interceptors.response.use(
      (response) => {
        if (this.config.debug) {
          console.log('[LeapOCR] Response:', {
            status: response.status,
            data: response.data,
          });
        }
        return response;
      },
      (error: AxiosError) => {
        const sdkError = this.mapError(error);
        if (this.config.debug) {
          console.error('[LeapOCR] Response Error:', sdkError);
        }
        return Promise.reject(sdkError);
      }
    );
  }

  /**
   * Map Axios errors to SDK errors
   */
  private mapError(error: AxiosError): SDKError {
    const status = error.response?.status;
    const data = error.response?.data as any;
    const message = data?.message || data?.error || error.message;

    // Network errors
    if (!status) {
      return new NetworkError(
        `Network error: ${error.message}`,
        error as Error
      );
    }

    // Map by status code
    switch (status) {
      case 401:
        return new AuthenticationError(message);

      case 403:
        return new AuthorizationError(message);

      case 429: {
        const retryAfter = error.response?.headers['retry-after']
          ? parseInt(error.response.headers['retry-after'], 10)
          : undefined;
        return new RateLimitError(message, retryAfter);
      }

      case 400:
      case 422:
        return new ValidationError(message, data?.fields);

      default:
        return new APIError(message, status, data);
    }
  }

  /**
   * Get OCR service
   */
  get ocr(): OCRService {
    if (!this._ocr) {
      this._ocr = new OCRService(this.config);
    }
    return this._ocr;
  }

  /**
   * Close and cleanup resources
   */
  async close(): Promise<void> {
    // Cleanup if needed
  }
}
