import { SDKError } from './base.js';

/**
 * Error thrown when validation fails (400, 422)
 */
export class ValidationError extends SDKError {
  constructor(
    message: string,
    public fields?: Record<string, string[]>
  ) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}
