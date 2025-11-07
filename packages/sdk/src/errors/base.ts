/**
 * Base error class for all SDK errors
 */
export class SDKError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;

    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
