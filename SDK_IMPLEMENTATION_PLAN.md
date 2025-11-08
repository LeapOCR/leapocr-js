# LeapOCR JavaScript/TypeScript SDK - Implementation Plan

**Version**: 1.0.0
**Date**: 2025-11-08
**Based on**: Go SDK architecture and idiomatic JS/TS patterns

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Project Structure](#project-structure)
4. [API Surface](#api-surface)
5. [Implementation Phases](#implementation-phases)
6. [Technical Specifications](#technical-specifications)
7. [Testing Strategy](#testing-strategy)
8. [Build & Release Pipeline](#build--release-pipeline)

---

## Executive Summary

### Objectives

- Build idiomatic JavaScript/TypeScript SDK for LeapOCR API
- Support only SDK-tagged endpoints (lean API surface)
- Provide excellent DX with TypeScript types, auto-retry, and polling
- Follow two-layer architecture: generated + wrapper

### Key Decisions

| Decision            | Choice          | Rationale                                              |
| ------------------- | --------------- | ------------------------------------------------------ |
| **Build Tool**      | Kubb            | Modern OpenAPI → TypeScript generator with plugins     |
| **HTTP Client**     | Axios           | Built-in retry support, interceptors, timeout handling |
| **Package Manager** | pnpm            | Fast, efficient, workspace support                     |
| **Type System**     | TypeScript 5.0+ | Full type safety, branded types                        |
| **Testing**         | Vitest          | Fast, modern, ESM-native                               |
| **Bundler**         | tsup            | Simple, fast, supports multiple outputs                |

### SDK-Tagged Endpoints

```
POST   /ocr/uploads/direct          - Upload file directly
POST   /ocr/uploads/url             - Upload from URL
POST   /ocr/uploads/{job_id}/complete - Complete multipart upload
GET    /ocr/status/{job_id}         - Get job status
GET    /ocr/result/{job_id}         - Get results (paginated)
```

---

## Architecture Overview

### Two-Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│  Public API (index.ts)                              │
│  - Clean exports                                    │
│  - LeapOCR class                                    │
│  - Type exports                                     │
├─────────────────────────────────────────────────────┤
│  Wrapper Layer (src/)                               │
│  - client.ts          → Main SDK client            │
│  - services/ocr.ts    → High-level OCR operations  │
│  - utils/retry.ts     → Exponential backoff        │
│  - utils/polling.ts   → Job status polling         │
│  - utils/upload.ts    → File upload helpers        │
│  - utils/validation.ts → File/input validation     │
│  - errors/            → Typed error classes        │
├─────────────────────────────────────────────────────┤
│  Generated Layer (src/generated/)                   │
│  - models/            → Type definitions           │
│  - client.ts          → Axios-based API client     │
│  - schemas/           → Zod schemas (optional)     │
│  ⚠️  NEVER MANUALLY EDIT                           │
└─────────────────────────────────────────────────────┘
```

### Data Flow: File Upload → Result Retrieval

```
User Code
   ↓
client.ocr.processFile("doc.pdf")
   ↓
OCRService.processFile()
   ├─→ validateFile()           ← Check size, type
   ├─→ uploadFile()             ← POST /ocr/uploads/direct
   │      └─→ withRetry()       ← Exponential backoff
   ├─→ pollForCompletion()      ← GET /ocr/status/{job_id}
   │      ├─→ onProgress callback
   │      └─→ Check status loop
   └─→ getResults()             ← GET /ocr/result/{job_id}
          └─→ Handle pagination
```

---

## Project Structure

```
leapocr-js/
├── src/
│   ├── index.ts                    # Public exports
│   ├── client.ts                   # Main LeapOCR class
│   ├── services/
│   │   └── ocr.ts                  # OCRService implementation
│   ├── types/
│   │   ├── config.ts               # ClientConfig, options
│   │   ├── ocr.ts                  # OCR-specific types
│   │   └── common.ts               # Shared types
│   ├── errors/
│   │   ├── base.ts                 # SDKError base class
│   │   ├── auth.ts                 # AuthenticationError
│   │   ├── rate-limit.ts           # RateLimitError
│   │   ├── file.ts                 # FileError
│   │   ├── job.ts                  # JobError, JobFailedError
│   │   └── index.ts                # Re-exports
│   ├── utils/
│   │   ├── retry.ts                # withRetry function
│   │   ├── polling.ts              # pollUntil function
│   │   ├── upload.ts               # File upload helpers
│   │   ├── validation.ts           # File validation
│   │   └── constants.ts            # MAX_FILE_SIZE, etc.
│   └── generated/                  # Kubb output
│       ├── models/
│       ├── client.ts
│       └── schemas/
├── tests/
│   ├── unit/
│   │   ├── client.test.ts
│   │   ├── ocr.test.ts
│   │   ├── retry.test.ts
│   │   ├── polling.test.ts
│   │   └── validation.test.ts
│   ├── integration/
│   │   ├── upload.test.ts
│   │   ├── processing.test.ts
│   │   └── errors.test.ts
│   └── fixtures/
│       ├── sample.pdf
│       ├── large.pdf
│       └── responses/
│           ├── job-status.json
│           └── job-result.json
├── examples/
│   ├── basic.ts                    # Simple file upload
│   ├── with-progress.ts            # Progress callback
│   ├── batch.ts                    # Multiple files
│   ├── url-upload.ts               # Upload from URL
│   └── error-handling.ts           # Error scenarios
├── scripts/
│   ├── filter-openapi.js           # Filter SDK endpoints
│   └── generate.js                 # Run Kubb generation
├── kubb.config.ts                  # Kubb configuration
├── package.json
├── tsconfig.json
├── tsup.config.ts                  # Build config
├── vitest.config.ts
└── README.md
```

---

## API Surface

### 1. Main Client

```typescript
import { LeapOCR } from "@leapocr/sdk";

// Minimal initialization
const client = new LeapOCR("api-key");

// With configuration
const client = new LeapOCR("api-key", {
  baseURL: "https://api.leapocr.com/api/v1",
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  debug: false,
});

// Cleanup
await client.close();
```

#### ClientConfig Interface

```typescript
interface ClientConfig {
  /** Base API URL. Default: https://api.leapocr.com/api/v1 */
  baseURL?: string;

  /** Request timeout in milliseconds. Default: 30000 (30s) */
  timeout?: number;

  /** Maximum retry attempts for transient errors. Default: 3 */
  maxRetries?: number;

  /** Initial delay between retries in ms. Default: 1000 */
  retryDelay?: number;

  /** Backoff multiplier for exponential retry. Default: 2 */
  retryMultiplier?: number;

  /** Custom Axios instance (advanced) */
  httpClient?: AxiosInstance;

  /** Enable debug logging */
  debug?: boolean;
}
```

---

### 2. OCR Service - Core API

```typescript
const ocr = client.ocr;

// ==================== FILE UPLOAD ====================

// Option 1: Upload local file
const result = await ocr.uploadFile("/path/to/document.pdf", {
  model: "standard-v1",
  webhook: "https://myapp.com/webhook",
});
// Returns: { jobId: string, status: 'pending' | 'processing' }

// Option 2: Upload from buffer
const buffer = fs.readFileSync("document.pdf");
const result = await ocr.uploadFileBuffer(buffer, "document.pdf", options);

// Option 3: Upload from stream
const stream = fs.createReadStream("document.pdf");
const result = await ocr.uploadFileStream(stream, "document.pdf", options);

// Option 4: Upload from URL
const result = await ocr.uploadFromURL("https://example.com/doc.pdf", {
  model: "apex-v1",
});

// ==================== JOB MANAGEMENT ====================

// Get job status
const status = await ocr.getJobStatus(jobId);
// Returns: { jobId, status, progress?, estimatedCompletion?, error? }

// Get results (supports pagination)
const results = await ocr.getResults(jobId, { page: 1, limit: 100 });
// Returns: { jobId, pages: [...], pagination: {...} }

// ==================== CONVENIENCE METHOD ====================

// Upload + poll until completion (recommended for most use cases)
const results = await ocr.processFile(
  "/path/to/document.pdf",
  {
    model: "standard-v1",
  },
  {
    pollInterval: 2000, // Check every 2s
    maxWait: 300000, // Timeout after 5min
    onProgress: (status) => {
      console.log(`Progress: ${status.progress}%`);
    },
  },
);
// Returns: { jobId, pages: [...] } when complete

// ==================== BATCH PROCESSING ====================

// Upload multiple files in parallel
const results = await ocr.processBatch(
  [
    "/path/to/file1.pdf",
    "/path/to/file2.pdf",
    { data: buffer, fileName: "file3.pdf" },
  ],
  {
    model: "standard-v1",
    concurrency: 5, // Max 5 parallel uploads
  },
);
// Returns: { jobs: [...], totalFiles: 3 }
```

---

### 3. Upload Options

```typescript
interface UploadOptions {
  /** OCR model to use */
  model?: "standard-v1" | "apex-v1" | "genesis-v1";

  /** Webhook URL for job completion notifications */
  webhook?: string;

  /** Custom metadata (string values only) */
  metadata?: Record<string, string>;

  /** AbortSignal for cancellation */
  signal?: AbortSignal;

  /** Progress callback for multipart uploads */
  onUploadProgress?: (progress: UploadProgress) => void;
}

interface UploadProgress {
  loaded: number; // Bytes uploaded
  total: number; // Total bytes
  percentage: number; // 0-100
}
```

---

### 4. Polling Options

```typescript
interface PollOptions {
  /** Polling interval in ms. Default: 2000 */
  pollInterval?: number;

  /** Maximum wait time in ms. Default: 300000 (5min) */
  maxWait?: number;

  /** Progress callback */
  onProgress?: (status: JobStatus) => void;

  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}
```

---

### 5. Response Types

```typescript
// Job upload response
interface UploadResult {
  jobId: string;
  status: "pending" | "processing";
  createdAt: Date;
  estimatedCompletion?: Date;
}

// Job status response
interface JobStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number; // 0-100
  estimatedCompletion?: Date;
  error?: JobError;
  createdAt: Date;
  updatedAt: Date;
}

// Job results response
interface JobResult {
  jobId: string;
  status: "completed";
  pages: PageResult[];
  pagination: PaginationInfo;
  metadata: ResultMetadata;
}

interface PageResult {
  pageNumber: number;
  text: string;
  blocks?: TextBlock[];
  tables?: Table[];
  confidence?: number;
  dimensions?: { width: number; height: number };
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalResults: number;
  hasNext: boolean;
}

interface ResultMetadata {
  fileName: string;
  fileSize: number;
  totalPages: number;
  model: string;
  processingTime: number; // milliseconds
}
```

---

### 6. Error Handling

```typescript
import {
  SDKError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  FileError,
  JobError,
  JobFailedError,
  TimeoutError,
  NetworkError,
  APIError,
} from "@leapocr/sdk";

try {
  const result = await client.ocr.processFile("document.pdf");
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error("Invalid API key");
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof FileError) {
    console.error(`File error: ${error.message}`);
    console.error(`File: ${error.filePath}, Size: ${error.fileSize}`);
  } else if (error instanceof JobFailedError) {
    console.error(`Job ${error.jobId} failed: ${error.jobError?.message}`);
  } else if (error instanceof TimeoutError) {
    console.error(`Job ${error.jobId} timed out after ${error.timeoutMs}ms`);
  } else if (error instanceof SDKError) {
    console.error(`SDK error: ${error.message}`, error.cause);
  }
}
```

#### Error Class Hierarchy

```typescript
class SDKError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public cause?: Error
  );
}

class AuthenticationError extends SDKError {
  // 401 errors
}

class RateLimitError extends SDKError {
  constructor(
    message: string,
    public retryAfter?: number  // seconds
  );
  // 429 errors
}

class ValidationError extends SDKError {
  constructor(
    message: string,
    public fields?: Record<string, string[]>
  );
  // 400 errors with validation details
}

class FileError extends SDKError {
  constructor(
    message: string,
    public filePath?: string,
    public fileSize?: number
  );
  // File validation/access errors
}

class JobError extends SDKError {
  constructor(
    message: string,
    public jobId: string
  );
}

class JobFailedError extends JobError {
  constructor(
    jobId: string,
    public jobError?: { code: string; message: string }
  );
  // Job processing failures
}

class TimeoutError extends JobError {
  constructor(
    jobId: string,
    public timeoutMs: number
  );
  // Polling timeout
}

class NetworkError extends SDKError {
  // Connection/network errors
}

class APIError extends SDKError {
  constructor(
    message: string,
    statusCode: number,
    public response?: unknown
  );
  // Other API errors (5xx, etc)
}
```

---

### 7. Static Utilities

```typescript
// File validation
const validation = LeapOCR.validateFile("document.pdf", {
  maxSize: 100 * 1024 * 1024, // 100MB
  allowedTypes: ["pdf", "png", "jpg"],
});

if (!validation.valid) {
  console.error(validation.error);
}

// SDK information
const formats = LeapOCR.getSupportedFormats();
// Returns: ['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'webp']

const models = LeapOCR.getSupportedModels();
// Returns: [{ id: 'standard-v1', name: 'Standard', ... }, ...]

const version = LeapOCR.getVersion();
// Returns: '1.0.0'

// Constants
LeapOCR.MAX_FILE_SIZE; // 100 * 1024 * 1024
LeapOCR.SUPPORTED_FORMATS; // ['pdf', 'png', ...]
LeapOCR.DEFAULT_POLL_INTERVAL; // 2000
```

---

## Implementation Phases

### Phase 1: Project Setup (Day 1)

**Goal**: Bootstrap project with tooling and dependencies

**Tasks**:

1. Initialize pnpm workspace
2. Setup TypeScript with strict mode
3. Install dependencies:
   - axios (HTTP client)
   - axios-retry (retry logic)
   - form-data (multipart uploads)
   - @kubb/core, @kubb/swagger, @kubb/swagger-client, @kubb/swagger-ts
4. Configure Kubb for OpenAPI generation
5. Create filter script for SDK endpoints
6. Generate initial types from OpenAPI
7. Setup tsup for bundling (ESM + CJS)
8. Configure Vitest for testing

**Deliverables**:

- `package.json` with all dependencies
- `kubb.config.ts` configured
- `scripts/filter-openapi.js` working
- `src/generated/` populated with types
- Build pipeline functional

---

### Phase 2: Core Infrastructure (Day 2)

**Goal**: Implement base client and utilities

**Tasks**:

1. Create `SDKError` hierarchy
2. Implement `withRetry` utility
   - Exponential backoff
   - Retry-After header support
   - Configurable retry logic
3. Implement `pollUntil` utility
   - Polling with interval
   - Timeout handling
   - Progress callbacks
4. Create `LeapOCR` client class
   - Configuration management
   - Axios instance setup
   - Auth header injection
5. Setup request/response interceptors
   - Error mapping to SDK errors
   - Debug logging
   - Retry-After handling

**Deliverables**:

- `src/errors/` with all error classes
- `src/utils/retry.ts` with tests
- `src/utils/polling.ts` with tests
- `src/client.ts` with basic initialization
- Unit tests passing (>80% coverage)

---

### Phase 3: File Upload System (Day 3)

**Goal**: Implement robust file upload

**Tasks**:

1. Create file validation utility
   - Size validation
   - Type validation (by extension)
   - Readable check
2. Implement upload helpers
   - `uploadLocalFile()` - path-based
   - `uploadBuffer()` - memory-based
   - `uploadStream()` - stream-based
   - `uploadFromURL()` - URL-based
3. Handle multipart uploads
   - FormData construction
   - Progress tracking
   - Chunked uploads for large files
4. Error handling
   - Map API errors to FileError
   - Preserve context (path, size)

**Deliverables**:

- `src/utils/validation.ts` with tests
- `src/utils/upload.ts` with tests
- Support for all upload methods
- Error handling tested

---

### Phase 4: OCR Service Implementation (Day 4)

**Goal**: Build high-level OCR API

**Tasks**:

1. Create `OCRService` class
2. Implement core methods:
   - `uploadFile()` - with validation
   - `uploadFileBuffer()`
   - `uploadFileStream()`
   - `uploadFromURL()`
   - `getJobStatus()`
   - `getResults()` with pagination
3. Implement `processFile()` convenience method
   - Upload → poll → return results
   - Progress callbacks
   - Configurable polling
4. Implement `processBatch()`
   - Parallel uploads with concurrency limit
   - Aggregate results
5. Wire up to main client: `client.ocr`

**Deliverables**:

- `src/services/ocr.ts` complete
- All methods tested
- Integration tests against real API
- Example code working

---

### Phase 5: Advanced Features (Day 5)

**Goal**: Enhance DX with advanced patterns

**Tasks**:

1. AbortSignal support
   - Cancel uploads
   - Cancel polling
2. Progress events
   - Upload progress
   - Processing progress
3. Batch operations optimization
   - Smart concurrency
   - Retry failed uploads
4. Result pagination helpers
   - `getAll Results()` - auto-paginate
   - Async iteration support
5. TypeScript refinements
   - Branded types for IDs
   - Discriminated unions for status
   - Generic constraints

**Deliverables**:

- Cancellation working
- Progress callbacks tested
- Pagination helpers
- Enhanced types

---

### Phase 6: Testing & Documentation (Day 6)

**Goal**: Comprehensive test coverage and docs

**Tasks**:

1. **Unit Tests**:
   - Client initialization
   - Configuration merging
   - Retry logic (all scenarios)
   - Polling logic (success, failure, timeout)
   - File validation
   - Error mapping
2. **Integration Tests**:
   - Real file uploads
   - Status checking
   - Result retrieval
   - Error handling (rate limits, etc)
3. **Examples**:
   - `basic.ts` - simple upload
   - `with-progress.ts` - progress tracking
   - `batch.ts` - multiple files
   - `url-upload.ts` - upload from URL
   - `error-handling.ts` - error scenarios
4. **Documentation**:
   - README with quickstart
   - API reference
   - Migration guide (if needed)
   - Troubleshooting guide

**Deliverables**:

- > 90% test coverage
- All examples working
- README complete
- API docs generated (TSDoc)

---

## Technical Specifications

### 1. Kubb Configuration

**File**: `kubb.config.ts`

```typescript
import { defineConfig } from "@kubb/core";
import { pluginClient } from "@kubb/swagger-client";
import { pluginTs } from "@kubb/swagger-ts";

export default defineConfig({
  root: ".",
  input: {
    path: "./openapi-filtered.json",
  },
  output: {
    path: "./src/generated",
    clean: true,
  },
  plugins: [
    pluginTs({
      output: {
        path: "models",
      },
      dateType: "date",
      optionalType: "questionToken",
    }),
    pluginClient({
      output: {
        path: "client.ts",
      },
      client: {
        importPath: "axios",
      },
      dataReturnType: "data",
    }),
  ],
});
```

### 2. OpenAPI Filtering Script

**File**: `scripts/filter-openapi.js`

```javascript
#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Fetch OpenAPI spec
const OPENAPI_URL =
  process.env.OPENAPI_URL || "http://localhost:8080/api/v1/docs/openapi.json";

async function fetchSpec() {
  const response = await fetch(OPENAPI_URL);
  return response.json();
}

function filterSDKEndpoints(spec) {
  const filtered = {
    ...spec,
    paths: {},
  };

  // Keep only paths with "SDK" tag
  Object.entries(spec.paths).forEach(([path, methods]) => {
    const filteredMethods = {};

    Object.entries(methods).forEach(([method, details]) => {
      if (details.tags?.includes("SDK")) {
        filteredMethods[method] = details;
      }
    });

    if (Object.keys(filteredMethods).length > 0) {
      filtered.paths[path] = filteredMethods;
    }
  });

  return filtered;
}

async function main() {
  console.log("Fetching OpenAPI spec...");
  const spec = await fetchSpec();

  console.log("Filtering SDK endpoints...");
  const filtered = filterSDKEndpoints(spec);

  console.log(`Kept ${Object.keys(filtered.paths).length} paths`);

  const outputPath = path.join(__dirname, "..", "openapi-filtered.json");
  fs.writeFileSync(outputPath, JSON.stringify(filtered, null, 2));

  console.log(`Filtered spec written to ${outputPath}`);
}

main().catch(console.error);
```

### 3. Retry Logic Implementation

**File**: `src/utils/retry.ts`

```typescript
import { AxiosError } from "axios";
import { RateLimitError, NetworkError } from "../errors";

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  multiplier: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2,
};

export function isRetriableError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) return false;

  const status = error.response?.status;

  // Network errors
  if (!status || error.code === "ECONNABORTED") return true;

  // Server errors (5xx)
  if (status >= 500) return true;

  // Rate limit (429)
  if (status === 429) return true;

  // Request timeout (408)
  if (status === 408) return true;

  // Don't retry:
  // - Auth errors (401, 403)
  // - Validation errors (400, 422)
  // - Not found (404)
  return false;
}

export function getRetryDelay(
  attempt: number,
  options: RetryOptions,
  error: unknown,
): number {
  // Check for Retry-After header
  if (error instanceof AxiosError && error.response?.headers["retry-after"]) {
    const retryAfter = parseInt(error.response.headers["retry-after"], 10);
    if (!isNaN(retryAfter)) {
      return retryAfter * 1000; // Convert to ms
    }
  }

  // Exponential backoff
  const delay = Math.min(
    options.initialDelay * Math.pow(options.multiplier, attempt),
    options.maxDelay,
  );

  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if not retriable
      if (!isRetriableError(error)) {
        throw error;
      }

      // Don't retry if last attempt
      if (attempt === opts.maxRetries) {
        throw error;
      }

      // Calculate delay
      const delay = getRetryDelay(attempt, opts, error);

      // Call retry callback
      opts.onRetry?.(attempt + 1, lastError);

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
```

### 4. Polling Implementation

**File**: `src/utils/polling.ts`

```typescript
import { TimeoutError } from "../errors";

export interface PollOptions<T> {
  pollInterval: number;
  maxWait: number;
  signal?: AbortSignal;
  onProgress?: (value: T) => void;
}

const DEFAULT_OPTIONS: Omit<PollOptions<any>, "signal"> = {
  pollInterval: 2000,
  maxWait: 300000, // 5 minutes
};

export async function pollUntil<T>(
  operation: () => Promise<T>,
  condition: (value: T) => boolean,
  options: Partial<PollOptions<T>> = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  while (true) {
    // Check for cancellation
    if (opts.signal?.aborted) {
      throw new Error("Polling cancelled");
    }

    // Execute operation
    const value = await operation();

    // Call progress callback
    opts.onProgress?.(value);

    // Check condition
    if (condition(value)) {
      return value;
    }

    // Check timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= opts.maxWait) {
      throw new TimeoutError("Polling timeout", opts.maxWait);
    }

    // Wait before next poll
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(opts.pollInterval, opts.maxWait - elapsed)),
    );
  }
}
```

### 5. File Validation

**File**: `src/utils/validation.ts`

```typescript
import fs from "fs";
import path from "path";

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const SUPPORTED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".tiff",
  ".tif",
  ".webp",
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface ValidationOptions {
  maxSize?: number;
  allowedTypes?: string[];
}

export function validateFile(
  filePath: string,
  options: ValidationOptions = {},
): ValidationResult {
  const maxSize = options.maxSize ?? MAX_FILE_SIZE;
  const allowedTypes = options.allowedTypes ?? SUPPORTED_EXTENSIONS;

  // Check file exists
  if (!fs.existsSync(filePath)) {
    return {
      valid: false,
      error: `File not found: ${filePath}`,
    };
  }

  // Check is file (not directory)
  const stats = fs.statSync(filePath);
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
  const ext = path.extname(filePath).toLowerCase();
  if (!allowedTypes.includes(ext)) {
    return {
      valid: false,
      error: `File type '${ext}' not supported. Allowed: ${allowedTypes.join(", ")}`,
    };
  }

  // Check readable
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch {
    return {
      valid: false,
      error: `File not readable: ${filePath}`,
    };
  }

  return { valid: true };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// tests/unit/retry.test.ts
import { describe, it, expect, vi } from "vitest";
import { withRetry, isRetriableError } from "../../src/utils/retry";
import { AxiosError } from "axios";

describe("withRetry", () => {
  it("succeeds on first attempt", async () => {
    const operation = vi.fn().mockResolvedValue("success");
    const result = await withRetry(operation);

    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("retries on 5xx errors", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new AxiosError("Server error", "500"))
      .mockRejectedValueOnce(new AxiosError("Server error", "500"))
      .mockResolvedValueOnce("success");

    const result = await withRetry(operation, { maxRetries: 3 });

    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry on 401 errors", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new AxiosError("Unauthorized", "401"));

    await expect(withRetry(operation)).rejects.toThrow("Unauthorized");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("respects Retry-After header", async () => {
    const error = new AxiosError("Rate limited");
    error.response = {
      status: 429,
      headers: { "retry-after": "2" },
    } as any;

    const operation = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce("success");

    const start = Date.now();
    await withRetry(operation, { maxRetries: 1 });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(2000);
  });
});
```

### Integration Tests

```typescript
// tests/integration/upload.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { LeapOCR } from "../../src";
import path from "path";

describe("OCR Integration", () => {
  let client: LeapOCR;

  beforeAll(() => {
    const apiKey = process.env.LEAPOCR_API_KEY;
    if (!apiKey) {
      throw new Error("LEAPOCR_API_KEY required");
    }
    client = new LeapOCR(apiKey);
  });

  afterAll(async () => {
    await client.close();
  });

  it("uploads and processes a PDF file", async () => {
    const filePath = path.join(__dirname, "../fixtures/sample.pdf");

    const result = await client.ocr.processFile(
      filePath,
      {
        model: "standard-v1",
      },
      {
        maxWait: 60000,
        onProgress: (status) => {
          console.log(`Progress: ${status.progress}%`);
        },
      },
    );

    expect(result.status).toBe("completed");
    expect(result.pages.length).toBeGreaterThan(0);
    expect(result.pages[0].text).toBeTruthy();
  }, 120000); // 2 minute timeout

  it("handles rate limiting", async () => {
    // Submit many jobs quickly
    const promises = Array.from({ length: 10 }, (_, i) =>
      client.ocr.uploadFile(`file${i}.pdf`),
    );

    const results = await Promise.allSettled(promises);

    // Should not throw, retry logic handles 429
    const successful = results.filter((r) => r.status === "fulfilled");
    expect(successful.length).toBeGreaterThan(0);
  });
});
```

---

## Build & Release Pipeline

### Package.json Scripts

```json
{
  "name": "@leapocr/sdk",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "generate": "node scripts/filter-openapi.js && kubb generate",
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vitest run tests/integration",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write \"src/**/*.ts\"",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "pnpm run build && pnpm run test"
  },
  "dependencies": {
    "axios": "^1.6.2",
    "axios-retry": "^4.0.0",
    "form-data": "^4.0.0"
  },
  "devDependencies": {
    "@kubb/cli": "^2.0.0",
    "@kubb/core": "^2.0.0",
    "@kubb/swagger": "^2.0.0",
    "@kubb/swagger-client": "^2.0.0",
    "@kubb/swagger-ts": "^2.0.0",
    "@types/node": "^20.10.0",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "@typescript-eslint/parser": "^6.13.0",
    "@vitest/coverage-v8": "^1.0.0",
    "eslint": "^8.55.0",
    "prettier": "^3.1.0",
    "tsup": "^8.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

### tsup Configuration

```typescript
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true,
});
```

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "src/generated/**",
        "tests/**",
        "**/*.test.ts",
        "**/*.config.ts",
      ],
    },
    testTimeout: 30000,
  },
});
```

---

## Summary

### Key Differences from Go SDK

| Aspect             | Go SDK                 | JS/TS SDK              |
| ------------------ | ---------------------- | ---------------------- |
| **Concurrency**    | Goroutines + contexts  | Promises + AbortSignal |
| **Cancellation**   | `context.Context`      | `AbortSignal`          |
| **Error Handling** | Multiple return values | Throw exceptions       |
| **Configuration**  | Functional options     | Config object          |
| **File Handling**  | `io.Reader` interface  | Buffer/Stream/Path     |
| **HTTP Client**    | `net/http`             | Axios                  |
| **Retry Logic**    | Custom implementation  | axios-retry + custom   |
| **Type System**    | Structs + interfaces   | TypeScript types       |

### Success Metrics

- ✅ 5 SDK endpoints fully supported
- ✅ Two-layer architecture (generated + wrapper)
- ✅ >90% test coverage
- ✅ Idiomatic TypeScript/JavaScript API
- ✅ Comprehensive error handling
- ✅ File upload with validation
- ✅ Polling with progress callbacks
- ✅ ESM + CJS bundles
- ✅ Full TypeScript types
- ✅ Working examples

### Next Steps

1. Initialize project structure
2. Setup Kubb and generate types
3. Implement core utilities (retry, polling)
4. Build OCR service wrapper
5. Add comprehensive tests
6. Write documentation and examples
7. Publish to npm

---

_Generated: 2025-11-08_
_Based on: Go SDK architecture + idiomatic JS/TS patterns_
