import { SDKError } from './base.js';

/**
 * Error thrown when file operations fail
 */
export class FileError extends SDKError {
  constructor(
    message: string,
    public filePath?: string,
    public fileSize?: number,
    cause?: Error
  ) {
    super(message, 'FILE_ERROR', undefined, cause);
  }
}
