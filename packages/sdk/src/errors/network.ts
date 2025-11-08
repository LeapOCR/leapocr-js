import { SDKError } from "./base.js";

/**
 * Error thrown when network operations fail
 */
export class NetworkError extends SDKError {
  constructor(message: string, cause?: Error) {
    super(message, "NETWORK_ERROR", undefined, cause);
  }
}

/**
 * Generic API error for unhandled status codes
 */
export class APIError extends SDKError {
  constructor(
    message: string,
    statusCode: number,
    public response?: unknown,
  ) {
    super(message, "API_ERROR", statusCode);
  }
}
