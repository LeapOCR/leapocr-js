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
  JobStatus,
  JobStatusType,
  OCRModel,
  PaginationInfo,
  PollOptions,
  ResultMetadata,
  UploadOptions,
  UploadResult,
} from "./types/index.js";

// Errors
export {
  APIError,
  AuthenticationError,
  AuthorizationError,
  FileError,
  JobError,
  JobFailedError,
  NetworkError,
  RateLimitError,
  SDKError,
  TimeoutError,
  ValidationError,
} from "./errors/index.js";

// Constants
export {
  DEFAULT_MAX_WAIT,
  DEFAULT_POLL_INTERVAL,
  MAX_FILE_SIZE,
  SDK_VERSION,
  SUPPORTED_EXTENSIONS,
} from "./utils/constants.js";

// Utilities (for advanced use)
export { validateBuffer, validateFile } from "./utils/validation.js";
export type { ValidationResult } from "./utils/validation.js";
