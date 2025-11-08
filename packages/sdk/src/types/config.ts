import type { AxiosInstance } from "axios";

/**
 * Client configuration options
 */
export interface ClientConfig {
  /** Base API URL. Default: https://api.leapocr.com/api/v1 */
  baseURL?: string;

  /** Request timeout in milliseconds. Default: 30000 (30s) */
  timeout?: number;

  /** Maximum retry attempts for transient errors. Default: 3 */
  maxRetries?: number;

  /** Initial delay between retries in ms. Default: 1000 */
  retryDelay?: number;

  /** Backoff multiplier for exponential retry. Default: 2 */
  retryMultiplier?: number;

  /** Custom Axios instance (advanced) */
  httpClient?: AxiosInstance;

  /** Enable debug logging */
  debug?: boolean;
}
