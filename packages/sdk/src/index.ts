/**
 * LeapOCR SDK for JavaScript/TypeScript
 *
 * @packageDocumentation
 */

// Main client
export { LeapOCR } from "./client.js";

// Services
export { OCRService } from "./services/ocr.js";

// Types
export type {
  ClientConfig,
  OCRModel,
  UploadOptions,
  PollOptions,
  JobStatus,
  JobStatusType,
  UploadResult,
  PaginationInfo,
  ResultMetadata,
  FileData,
  BatchOptions,
  BatchResult,
} from "./types/index.js";

// Errors
export {
  SDKError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ValidationError,
  FileError,
  JobError,
  JobFailedError,
  TimeoutError,
  NetworkError,
  APIError,
} from "./errors/index.js";

// Constants
export {
  MAX_FILE_SIZE,
  SUPPORTED_EXTENSIONS,
  DEFAULT_POLL_INTERVAL,
  DEFAULT_MAX_WAIT,
  SDK_VERSION,
} from "./utils/constants.js";

// Utilities (for advanced use)
export { validateFile, validateBuffer } from "./utils/validation.js";
export type { ValidationResult } from "./utils/validation.js";
