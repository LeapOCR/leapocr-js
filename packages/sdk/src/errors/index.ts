/**
 * Error classes for the LeapOCR SDK
 */

export { SDKError } from "./base.js";
export { AuthenticationError, AuthorizationError } from "./auth.js";
export { RateLimitError } from "./rate-limit.js";
export { ValidationError } from "./validation.js";
export { FileError } from "./file.js";
export { JobError, JobFailedError, TimeoutError } from "./job.js";
export { NetworkError, APIError } from "./network.js";
