import { SDKError } from './base.js';

/**
 * Error thrown when authentication fails (401)
 */
export class AuthenticationError extends SDKError {
  constructor(message: string = 'Invalid API key') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

/**
 * Error thrown when authorization fails (403)
 */
export class AuthorizationError extends SDKError {
  constructor(message: string = 'Access forbidden') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}
