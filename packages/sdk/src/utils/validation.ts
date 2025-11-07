import { statSync, accessSync, constants as fsConstants } from 'fs';
import { extname } from 'path';
import { MAX_FILE_SIZE, SUPPORTED_EXTENSIONS } from './constants.js';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface ValidationOptions {
  maxSize?: number;
  allowedTypes?: string[];
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validate a file path
 */
export function validateFile(
  filePath: string,
  options: ValidationOptions = {}
): ValidationResult {
  const maxSize = options.maxSize ?? MAX_FILE_SIZE;
  const allowedTypes = options.allowedTypes ?? SUPPORTED_EXTENSIONS;

  try {
    // Check file exists and get stats
    const stats = statSync(filePath);

    // Check is file (not directory)
    if (!stats.isFile()) {
      return {
        valid: false,
        error: `Path is not a file: ${filePath}`,
      };
    }

    // Check file size
    if (stats.size > maxSize) {
      return {
        valid: false,
        error: `File size ${formatBytes(stats.size)} exceeds maximum ${formatBytes(maxSize)}`,
      };
    }

    // Check file type
    const ext = extname(filePath).toLowerCase();
    if (!allowedTypes.includes(ext as any)) {
      return {
        valid: false,
        error: `File type '${ext}' not supported. Allowed: ${allowedTypes.join(', ')}`,
      };
    }

    // Check readable
    try {
      accessSync(filePath, fsConstants.R_OK);
    } catch {
      return {
        valid: false,
        error: `File not readable: ${filePath}`,
      };
    }

    return { valid: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        valid: false,
        error: `File not found: ${filePath}`,
      };
    }

    return {
      valid: false,
      error: `Failed to validate file: ${(error as Error).message}`,
    };
  }
}

/**
 * Validate buffer data
 */
export function validateBuffer(
  buffer: Buffer,
  fileName: string,
  options: ValidationOptions = {}
): ValidationResult {
  const maxSize = options.maxSize ?? MAX_FILE_SIZE;
  const allowedTypes = options.allowedTypes ?? SUPPORTED_EXTENSIONS;

  // Check size
  if (buffer.length > maxSize) {
    return {
      valid: false,
      error: `Buffer size ${formatBytes(buffer.length)} exceeds maximum ${formatBytes(maxSize)}`,
    };
  }

  // Check file type by extension
  const ext = extname(fileName).toLowerCase();
  if (!allowedTypes.includes(ext as any)) {
    return {
      valid: false,
      error: `File type '${ext}' not supported. Allowed: ${allowedTypes.join(', ')}`,
    };
  }

  return { valid: true };
}
