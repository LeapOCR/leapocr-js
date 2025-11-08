/**
 * Maximum file size (100MB)
 */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * Supported file extensions
 */
export const SUPPORTED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".tiff",
  ".tif",
  ".webp",
] as const;

/**
 * Default polling interval (2 seconds)
 */
export const DEFAULT_POLL_INTERVAL = 2000;

/**
 * Default maximum wait time (5 minutes)
 */
export const DEFAULT_MAX_WAIT = 300000;

/**
 * SDK version
 */
export const SDK_VERSION = "0.0.0";
