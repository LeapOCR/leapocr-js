we need to create js/ts sdk for our site leapocr, here's the openapi url - http://localhost:8080/api/v1/docs/openapi.json,
the process will be to use kubb https://kubb.dev/getting-started/at-glance for generating full api to js/ts. Using the kubb generator https://kubb.dev/plugins/plugin-client/ https://kubb.dev/plugins/plugin-ts/ etc, then providing a custom interface using the generated api,
we are only creating sdk for the api with SDK tag, rest can be ignored. here's the docs from the go sdk and how it works there,
create a detailed plan for js/ts sdk based on it, we should follow idomatic js/ts apis, dont need to replicate go as it is.

# SDK Preparation Guide

This document captures the architecture, learnings, and design patterns from the Go SDK to guide implementation of Python and TypeScript SDKs.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Key Learnings](#key-learnings)
3. [Implementation Patterns](#implementation-patterns)
4. [Public API Specification](#public-api-specification)
5. [Language-Specific Considerations](#language-specific-considerations)
6. [Testing Strategy](#testing-strategy)
7. [Implementation Checklist](#implementation-checklist)

---

## Architecture Overview

### Two-Layer Architecture (Critical Pattern)

```
┌─────────────────────────────────────────┐
│  Public API (index.ts / __init__.py)    │  ← Clean exports
├─────────────────────────────────────────┤
│  Wrapper Layer (client/)                │  ← Idiomatic patterns
│  - Developer-friendly API               │  ← Retry logic
│  - Error handling & context            │  ← File helpers
│  - Convenience methods                  │  ← Type conversions
├─────────────────────────────────────────┤
│  Generated Layer (generated/)           │  ← Never manually edit
│  - OpenAPI-generated code              │  ← Auto-regenerated
│  - Raw API models                       │  ← Type definitions
└─────────────────────────────────────────┘
```

**Why This Architecture?**

- **Stability**: Wrapper insulates users from generated code changes
- **Developer Experience**: Idiomatic patterns per language
- **Regeneration Safety**: Can regenerate without breaking user code
- **Flexibility**: Add convenience methods without modifying generated code

### Build Pipeline

```bash
1. Fetch OpenAPI spec from API
   ↓
2. Filter endpoints (keep only "SDK" tagged)
   ↓
3. Generate client code (openapi-generator)
   ↓
4. Create wrapper layer (language-specific)
   ↓
5. Export public API (clean interface)
```

**Key Script**: `scripts/filter-sdk-endpoints.sh`

- Language-agnostic (uses jq on OpenAPI JSON)
- Keeps only endpoints tagged with "SDK"
- Preserves all referenced schemas/components
- Reduces SDK surface area and maintenance burden

---

## Key Learnings

### 1. Endpoint Filtering is Essential

**Problem**: Full API spec includes admin, internal, and experimental endpoints.

**Solution**: Tag public SDK endpoints in OpenAPI spec, filter during generation.

**Implementation**:

```bash
# filter-sdk-endpoints.sh extracts:
- Paths with "SDK" tag
- All component schemas referenced by those paths
- Required security schemes
- Server URLs
```

**Benefits**:

- Clear API boundary
- Smaller SDK size
- Easier versioning
- Better documentation focus

### 2. File Processing Needs Two Approaches

**Pattern**: Support both file path and stream/buffer input.

```go
// Go example
ProcessFileFromPath(ctx, "/path/to/file.pdf", options)
ProcessFile(ctx, io.Reader, fileName, options)
```

**Rationale**:

- **Path method**: CLI tools, simple scripts, local files
- **Stream method**: Web servers, memory buffers, piped data

**Python equivalent**:

```python
await client.ocr.process_file("file.pdf")
await client.ocr.process_file_stream(file_data, "file.pdf")
```

**TypeScript equivalent**:

```typescript
await client.ocr.processFile("file.pdf");
await client.ocr.processFileStream(buffer, "file.pdf");
```

### 3. Configuration Philosophy: Zero-Config to Power-User

**Principle**: Make simple things simple, complex things possible.

```typescript
// Minimal - just works
const client = new LeapOCR("api-key");

// Advanced - full control
const client = new LeapOCR("api-key", {
  baseURL: "https://custom.api.com",
  timeout: 60000,
  maxRetries: 5,
  retryDelay: 2000,
  onRetry: (attempt, error) => console.log(`Retry ${attempt}`),
  httpClient: customAxiosInstance,
});
```

**Implementation Pattern**: Functional options (Go) or config objects (Python/TS).

### 4. Retry Logic Must Be Built-In

**Requirements**:

```
Transient errors (5xx, network) → Retry with exponential backoff
Rate limits (429)               → Retry with delay from Retry-After header
Auth errors (401, 403)          → Fail fast, no retry
Validation errors (400)         → Fail fast, no retry
Timeout errors                  → Retry (configurable)
```

**Implementation**:

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetriable(error)) throw error;
      if (attempt === options.maxRetries) throw error;

      const delay = calculateBackoff(attempt, options);
      await sleep(delay);
      lastError = error;
    }
  }

  throw lastError;
}
```

### 5. Context/Cancellation is Non-Negotiable

**Pattern**: Every network operation must support cancellation.

**Go**: `context.Context` parameter

```go
func (c *Client) ProcessFile(ctx context.Context, ...) (*Result, error)
```

**Python**: `asyncio` cancellation

```python
async def process_file(self, file_path: str, ...) -> Result:
    # Respects asyncio.CancelledError
```

**TypeScript**: `AbortSignal`

```typescript
async processFile(
    filePath: string,
    options?: { signal?: AbortSignal }
): Promise<Result>
```

### 6. File Validation Before Upload

**Learning**: Validate client-side to save API roundtrips.

**From commit `2a63a67`**: Added file size validation and improved error handling.

```typescript
function validateFile(filePath: string): ValidationResult {
  const stats = fs.statSync(filePath);

  if (stats.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size ${stats.size} exceeds maximum ${MAX_FILE_SIZE}`,
    };
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `File type ${ext} not supported`,
    };
  }

  return { valid: true };
}
```

### 7. Error Wrapping with Context

**Pattern**: Preserve original error, add operation context.

```typescript
class FileProcessingError extends SDKError {
  constructor(
    message: string,
    public filePath: string,
    public fileSize?: number,
    cause?: Error,
  ) {
    super(message, cause);
  }
}

// Usage
throw new FileProcessingError(
  "Failed to process PDF",
  "/path/to/file.pdf",
  stats.size,
  originalError,
);
```

### 8. Polling Strategy for Async Jobs

**Pattern**: ProcessAndWait convenience method with configurable polling.

```typescript
async processAndWait(
    filePath: string,
    options?: ProcessOptions,
    pollOptions?: {
        pollInterval?: number,    // Default: 2000ms
        maxWait?: number,         // Default: 300000ms (5min)
        onProgress?: (status: JobStatus) => void,
    }
): Promise<JobResult> {
    // 1. Submit job
    const result = await this.processFile(filePath, options)

    // 2. Poll until complete
    const startTime = Date.now()
    while (true) {
        const status = await this.getJobStatus(result.jobId)

        if (pollOptions?.onProgress) {
            pollOptions.onProgress(status)
        }

        if (status.status === "completed") {
            return await this.getResults(result.jobId)
        }

        if (status.status === "failed") {
            throw new JobFailedError(result.jobId, status.error)
        }

        if (Date.now() - startTime > (pollOptions?.maxWait ?? 300000)) {
            throw new TimeoutError(result.jobId)
        }

        await sleep(pollOptions?.pollInterval ?? 2000)
    }
}
```

---

## Implementation Patterns

### Pattern 1: Functional Options (Go)

```go
type ClientOption func(*Client)

func WithBaseURL(url string) ClientOption {
    return func(c *Client) {
        c.baseURL = url
    }
}

func WithRetries(n int) ClientOption {
    return func(c *Client) {
        c.maxRetries = n
    }
}

// Usage
client := New("api-key", WithRetries(5), WithBaseURL("https://api.com"))
```

### Pattern 2: Config Object (Python/TypeScript)

**TypeScript**:

```typescript
interface ClientConfig {
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  httpClient?: AxiosInstance;
}

class LeapOCR {
  constructor(apiKey: string, config?: ClientConfig) {
    this.config = {
      baseURL: "https://api.leapocr.com",
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };
  }
}
```

**Python**:

```python
@dataclass
class ClientConfig:
    base_url: str = "https://api.leapocr.com"
    timeout: int = 30
    max_retries: int = 3
    retry_delay: float = 1.0
    http_client: Optional[httpx.AsyncClient] = None

class LeapOCR:
    def __init__(self, api_key: str, config: Optional[ClientConfig] = None):
        self.config = config or ClientConfig()
```

### Pattern 3: Type-Safe Enums

**Go**:

```go
type Format string

const (
    FormatStructured Format = "structured"
    FormatRaw        Format = "raw"
)

type Model string

const (
    ModelStandardV1 Model = "standard-v1"
    ModelApexV1     Model = "apex-v1"
)
```

**TypeScript**:

```typescript
export type Format = "structured" | "raw";
export type Model = "standard-v1" | "apex-v1" | "genesis-v1";

// Or enums for better IDE support
export enum Format {
  Structured = "structured",
  Raw = "raw",
}
```

**Python**:

```python
from enum import Enum

class Format(str, Enum):
    STRUCTURED = "structured"
    RAW = "raw"

class Model(str, Enum):
    STANDARD_V1 = "standard-v1"
    APEX_V1 = "apex-v1"
    GENESIS_V1 = "genesis-v1"
```

### Pattern 4: Progress Callbacks

```typescript
// Allow users to track long-running operations
interface ProgressCallback {
    (status: JobStatus): void
}

async processAndWait(
    filePath: string,
    options?: {
        onProgress?: ProgressCallback
    }
): Promise<JobResult> {
    // ... polling loop
    if (options?.onProgress) {
        options.onProgress({
            jobId: result.jobId,
            status: "processing",
            progress: 45,
            estimatedCompletion: new Date(...)
        })
    }
}
```

---

## Public API Specification

### Core Client

```typescript
// ============================================
// INITIALIZATION
// ============================================

class LeapOCR {
  constructor(apiKey: string, config?: ClientConfig);

  // Service accessors
  readonly ocr: OCRService;
  readonly account: AccountService;

  // Utility methods
  async health(): Promise<boolean>;
  close(): void; // Cleanup resources
}

interface ClientConfig {
  baseURL?: string; // Default: https://api.leapocr.com
  timeout?: number; // Default: 30000 (30s)
  maxRetries?: number; // Default: 3
  retryDelay?: number; // Default: 1000 (1s)
  retryMultiplier?: number; // Default: 2 (exponential backoff)
  httpClient?: HttpClient; // Custom HTTP client
  userAgent?: string; // Custom user agent
  debug?: boolean; // Enable debug logging
}
```

### OCR Service

```typescript
// ============================================
// OCR SERVICE
// ============================================

interface OCRService {
  // Core operations
  processFile(
    filePath: string,
    options?: ProcessOptions,
  ): Promise<ProcessResult>;

  processFileStream(
    fileData: Buffer | Stream | Readable,
    fileName: string,
    options?: ProcessOptions,
  ): Promise<ProcessResult>;

  // Job management
  getJobStatus(jobId: string): Promise<JobStatus>;
  getResults(jobId: string): Promise<JobResult>;
  cancelJob(jobId: string): Promise<void>;

  // Convenience methods
  processAndWait(
    filePath: string,
    options?: ProcessOptions,
    pollOptions?: PollOptions,
  ): Promise<JobResult>;

  // Batch operations
  processBatch(
    files: string[] | FileData[],
    options?: ProcessOptions,
  ): Promise<BatchResult>;

  // List jobs
  listJobs(
    filters?: JobFilters,
    pagination?: PaginationOptions,
  ): Promise<JobList>;
}

interface ProcessOptions {
  format?: "structured" | "raw";
  model?: "standard-v1" | "apex-v1" | "genesis-v1";
  webhook?: string;
  metadata?: Record<string, string>;
  signal?: AbortSignal; // For cancellation
}

interface PollOptions {
  pollInterval?: number; // Default: 2000ms
  maxWait?: number; // Default: 300000ms (5min)
  onProgress?: (status: JobStatus) => void;
}
```

### Type Definitions

```typescript
// ============================================
// RESPONSE TYPES
// ============================================

interface ProcessResult {
  jobId: string;
  status: JobStatus;
  createdAt: Date;
  estimatedCompletion?: Date;
}

type JobStatusType = "pending" | "processing" | "completed" | "failed";

interface JobStatus {
  jobId: string;
  status: JobStatusType;
  progress?: number; // 0-100
  estimatedCompletion?: Date;
  error?: ErrorDetail;
  createdAt: Date;
  updatedAt: Date;
}

interface JobResult {
  jobId: string;
  status: "completed";
  pages: PageResult[];
  metadata: ResultMetadata;
}

interface ResultMetadata {
  totalPages: number;
  processingTime: number; // milliseconds
  model: string;
  format: string;
  fileSize: number;
  fileName: string;
}

interface PageResult {
  pageNumber: number;

  // Structured format fields
  text?: string;
  blocks?: TextBlock[];
  tables?: Table[];
  forms?: FormField[];

  // Raw format fields
  rawData?: unknown;

  // Common fields
  confidence?: number;
  dimensions?: { width: number; height: number };
  processingTime?: number;
}

interface TextBlock {
  text: string;
  boundingBox: BoundingBox;
  confidence: number;
  type: "heading" | "paragraph" | "list" | "caption" | "footer";
  fontSize?: number;
  fontFamily?: string;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Table {
  rows: number;
  columns: number;
  cells: TableCell[];
  boundingBox: BoundingBox;
  confidence: number;
}

interface TableCell {
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
}

interface FormField {
  key: string;
  value: string;
  confidence: number;
  keyBoundingBox: BoundingBox;
  valueBoundingBox: BoundingBox;
}
```

### Error Types

```typescript
// ============================================
// ERROR TYPES
// ============================================

class SDKError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: unknown,
    cause?: Error
  );
}

class AuthenticationError extends SDKError {
  constructor(message: string = "Invalid API key");
}

class RateLimitError extends SDKError {
  constructor(
    message: string,
    public retryAfter?: number // seconds
  );
}

class ValidationError extends SDKError {
  constructor(message: string, public fields?: Record<string, string[]>);
}

class FileError extends SDKError {
  constructor(
    message: string,
    public filePath?: string,
    public fileSize?: number
  );
}

class JobError extends SDKError {
  constructor(message: string, public jobId: string);
}

class JobFailedError extends JobError {
  constructor(jobId: string, public error?: ErrorDetail);
}

class TimeoutError extends JobError {
  constructor(jobId: string, message: string = "Job processing timeout");
}

class NetworkError extends SDKError {
  constructor(message: string, cause?: Error);
}

class APIError extends SDKError {
  constructor(message: string, statusCode: number, public response?: unknown);
}

interface ErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}
```

### Batch Operations

```typescript
// ============================================
// BATCH OPERATIONS
// ============================================

interface FileData {
  data: Buffer | Stream | Readable;
  fileName: string;
}

interface BatchResult {
  batchId: string;
  jobs: ProcessResult[];
  totalFiles: number;
  submittedAt: Date;
}

interface BatchStatus {
  batchId: string;
  totalJobs: number;
  completed: number;
  failed: number;
  pending: number;
  processing: number;
  jobs: JobStatus[];
}

// Usage example
const results = await client.ocr.processBatch(
  ["file1.pdf", "file2.pdf", "file3.pdf"],
  { format: "structured", model: "standard-v1" },
);

// Poll batch status
const status = await client.ocr.getBatchStatus(results.batchId);
```

### Account Service

```typescript
// ============================================
// ACCOUNT SERVICE
// ============================================

interface AccountService {
  getUsage(period?: UsagePeriod): Promise<UsageMetrics>;
  getQuota(): Promise<QuotaInfo>;
  getApiKeys(): Promise<ApiKeyInfo[]>;
}

type UsagePeriod = "day" | "week" | "month" | "year";

interface UsageMetrics {
  period: UsagePeriod;
  startDate: Date;
  endDate: Date;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalPages: number;
  totalCost: number;
  breakdown: UsageBreakdown[];
}

interface UsageBreakdown {
  date: Date;
  jobs: number;
  pages: number;
  cost: number;
  modelBreakdown: Record<string, number>;
}

interface QuotaInfo {
  plan: string;
  monthlyQuota: number;
  usedQuota: number;
  remainingQuota: number;
  resetDate: Date;
}

interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsed?: Date;
  expiresAt?: Date;
}
```

### Static Utility Methods

```typescript
// ============================================
// STATIC UTILITIES
// ============================================

class LeapOCR {
  // File validation
  static validateFile(
    filePath: string,
    options?: {
      maxSize?: number; // bytes
      allowedTypes?: string[]; // ["pdf", "png", "jpg"]
    },
  ): ValidationResult;

  // Get SDK information
  static getSupportedFormats(): string[];
  static getSupportedModels(): ModelInfo[];
  static getVersion(): string;

  // Constants
  static readonly MAX_FILE_SIZE: number;
  static readonly SUPPORTED_FORMATS: string[];
  static readonly DEFAULT_POLL_INTERVAL: number;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

interface ModelInfo {
  id: string;
  name: string;
  description: string;
  maxFileSize: number;
  supportedFormats: string[];
  pricing: {
    perPage: number;
    currency: string;
  };
}
```

---

## Language-Specific Considerations

### Python SDK

**File**: `leapocr-python/`

**Key Differences**:

1. **Async/Sync API**:

```python
# Async (primary)
async with LeapOCR("api-key") as client:
    result = await client.ocr.process_file("file.pdf")

# Sync (convenience wrapper)
client = LeapOCR("api-key")
result = client.ocr.process_file_sync("file.pdf")
```

2. **Type Hints**:

```python
from typing import Optional, List, Dict, Union, Literal
from dataclasses import dataclass

@dataclass
class ProcessOptions:
    format: Optional[Literal["structured", "raw"]] = None
    model: Optional[Literal["standard-v1", "apex-v1", "genesis-v1"]] = None
    webhook: Optional[str] = None
    metadata: Optional[Dict[str, str]] = None
```

3. **Context Managers**:

```python
class LeapOCR:
    async def __aenter__(self) -> "LeapOCR":
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
```

4. **File Handling**:

```python
from pathlib import Path
from typing import Union, BinaryIO

async def process_file(
    self,
    file: Union[str, Path, BinaryIO],
    options: Optional[ProcessOptions] = None
) -> ProcessResult:
    if isinstance(file, (str, Path)):
        # Handle path
    else:
        # Handle file-like object
```

5. **Error Handling**:

```python
try:
    result = await client.ocr.process_file("file.pdf")
except AuthenticationError:
    print("Invalid API key")
except RateLimitError as e:
    print(f"Rate limited, retry after {e.retry_after}s")
except FileError as e:
    print(f"File error: {e.message}")
```

6. **HTTP Client**:

```python
# Use httpx for async HTTP
import httpx

class LeapOCR:
    def __init__(
        self,
        api_key: str,
        config: Optional[ClientConfig] = None,
        http_client: Optional[httpx.AsyncClient] = None
    ):
        self.http_client = http_client or httpx.AsyncClient(
            timeout=config.timeout,
            headers={"Authorization": f"Bearer {api_key}"}
        )
```

7. **Generator Pattern for Streaming**:

```python
async def stream_results(
    self,
    job_id: str
) -> AsyncIterator[PageResult]:
    """Stream results page by page"""
    page = 1
    while True:
        try:
            result = await self._get_page(job_id, page)
            yield result
            page += 1
        except PageNotFoundError:
            break

# Usage
async for page in client.ocr.stream_results(job_id):
    print(f"Page {page.page_number}: {page.text}")
```

**Recommended Tools**:

- `openapi-python-client` or `openapi-generator-cli`
- `httpx` for async HTTP
- `pydantic` for data validation
- `poetry` for dependency management
- `pytest` + `pytest-asyncio` for testing
- `black` + `ruff` for linting

**Project Structure**:

```
leapocr-python/
├── leapocr/
│   ├── __init__.py           # Public exports
│   ├── client.py             # Main client
│   ├── ocr.py                # OCR service
│   ├── account.py            # Account service
│   ├── types.py              # Type definitions
│   ├── errors.py             # Error classes
│   ├── generated/            # OpenAPI generated code
│   └── utils/
│       ├── retry.py
│       ├── validation.py
│       └── polling.py
├── tests/
│   ├── test_client.py
│   ├── test_ocr.py
│   └── test_integration.py
├── examples/
│   ├── basic.py
│   ├── async_batch.py
│   └── streaming.py
├── pyproject.toml
└── README.md
```

### TypeScript SDK

**File**: `@leapocr/sdk` or `leapocr-ts/`

**Key Differences**:

1. **Promise-Based API**:

```typescript
const client = new LeapOCR("api-key");
const result = await client.ocr.processFile("file.pdf");
```

2. **Type Definitions**:

```typescript
// Strong typing with generics
export interface Client<T extends ClientConfig = ClientConfig> {
  readonly config: T;
  readonly ocr: OCRService;
}

// Branded types for IDs
export type JobId = string & { readonly __brand: "JobId" };
export type BatchId = string & { readonly __brand: "BatchId" };
```

3. **Builder Pattern** (optional):

```typescript
const client = new LeapOCR("api-key")
  .withBaseURL("https://custom.api.com")
  .withRetries(5)
  .withTimeout(60000)
  .build();
```

4. **File Handling**:

```typescript
import * as fs from "fs"
import { Readable } from "stream"

async processFile(
    file: string | Buffer | Readable,
    fileName?: string,
    options?: ProcessOptions
): Promise<ProcessResult>
```

5. **AbortSignal Support**:

```typescript
const controller = new AbortController();

const promise = client.ocr.processFile("file.pdf", {
  signal: controller.signal,
});

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  await promise;
} catch (error) {
  if (error.name === "AbortError") {
    console.log("Request cancelled");
  }
}
```

6. **Event Emitter** (optional):

```typescript
import { EventEmitter } from "events";

class OCRService extends EventEmitter {
  async processAndWait(filePath: string): Promise<JobResult> {
    // ...
    this.emit("progress", { jobId, progress: 45 });
    // ...
  }
}

// Usage
client.ocr.on("progress", (status) => {
  console.log(`Progress: ${status.progress}%`);
});
```

7. **HTTP Client**:

```typescript
import axios, { AxiosInstance } from "axios";

class LeapOCR {
  private httpClient: AxiosInstance;

  constructor(apiKey: string, config?: ClientConfig) {
    this.httpClient =
      config?.httpClient ??
      axios.create({
        baseURL: config?.baseURL ?? "https://api.leapocr.com",
        timeout: config?.timeout ?? 30000,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "User-Agent": `leapocr-sdk-ts/${VERSION}`,
        },
      });
  }
}
```

**Recommended Tools**:

- `openapi-typescript` or `@openapitools/openapi-generator-cli`
- `axios` for HTTP
- `zod` for runtime validation
- `tsup` or `rollup` for bundling
- `vitest` or `jest` for testing
- `eslint` + `prettier` for linting

**Project Structure**:

```
leapocr-ts/
├── src/
│   ├── index.ts              # Public exports
│   ├── client.ts             # Main client
│   ├── services/
│   │   ├── ocr.ts            # OCR service
│   │   └── account.ts        # Account service
│   ├── types/                # Type definitions
│   │   ├── common.ts
│   │   ├── ocr.ts
│   │   └── errors.ts
│   ├── generated/            # OpenAPI generated code
│   └── utils/
│       ├── retry.ts
│       ├── validation.ts
│       └── polling.ts
├── tests/
│   ├── client.test.ts
│   ├── ocr.test.ts
│   └── integration.test.ts
├── examples/
│   ├── basic.ts
│   ├── batch.ts
│   └── streaming.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## Testing Strategy

### Unit Tests

**Scope**: Test wrapper logic without hitting real API.

```typescript
describe("OCRService", () => {
    let client: LeapOCR
    let mockHttpClient: MockHttpClient

    beforeEach(() => {
        mockHttpClient = new MockHttpClient()
        client = new LeapOCR("test-key", {
            httpClient: mockHttpClient
        })
    })

    describe("processFile", () => {
        it("validates file size before upload", async () => {
            const largePath = "/path/to/100mb.pdf"
            mockFsSize(largePath, 100 * 1024 * 1024)

            await expect(
                client.ocr.processFile(largePath)
            ).rejects.toThrow(FileError)
        })

        it("retries on transient errors", async () => {
            mockHttpClient
                .onPost("/ocr/process")
                .replyOnce(500)
                .replyOnce(500)
                .replyOnce(200, { jobId: "123", status: "pending" })

            const result = await client.ocr.processFile("file.pdf")
            expect(result.jobId).toBe("123")
            expect(mockHttpClient.requestCount).toBe(3)
        })

        it("does not retry on auth errors", async () => {
            mockHttpClient
                .onPost("/ocr/process")
                .reply(401)

            await expect(
                client.ocr.processFile("file.pdf")
            ).rejects.toThrow(AuthenticationError)

            expect(mockHttpClient.requestCount).toBe(1)
        })
    })

    describe("processAndWait", () => {
        it("polls until completion", async () => {
            mockHttpClient
                .onPost("/ocr/process")
                .reply(200, { jobId: "123", status: "pending" })
                .onGet("/ocr/jobs/123")
                .replyOnce(200, { jobId: "123", status: "processing", progress: 50 })
                .replyOnce(200, { jobId: "123", status: "completed" })
                .onGet("/ocr/jobs/123/results")
                .reply(200, { jobId: "123", pages: [...] })

            const result = await client.ocr.processAndWait("file.pdf", {}, {
                pollInterval: 100
            })

            expect(result.pages).toBeDefined()
        })

        it("calls progress callback", async () => {
            const onProgress = jest.fn()

            await client.ocr.processAndWait("file.pdf", {}, {
                onProgress,
                pollInterval: 100
            })

            expect(onProgress).toHaveBeenCalledWith(
                expect.objectContaining({ status: "processing" })
            )
        })

        it("throws on timeout", async () => {
            mockHttpClient
                .onGet("/ocr/jobs/123")
                .reply(200, { jobId: "123", status: "processing" })

            await expect(
                client.ocr.processAndWait("file.pdf", {}, {
                    maxWait: 100,
                    pollInterval: 50
                })
            ).rejects.toThrow(TimeoutError)
        })
    })
})
```

### Integration Tests

**Scope**: Test against real API with test credentials.

```typescript
describe("Integration Tests", () => {
  let client: LeapOCR;

  beforeAll(() => {
    const apiKey = process.env.LEAPOCR_API_KEY;
    if (!apiKey) {
      throw new Error("LEAPOCR_API_KEY required for integration tests");
    }

    client = new LeapOCR(apiKey, {
      baseURL: process.env.OCR_BASE_URL || "https://api.leapocr.com",
    });
  });

  afterAll(async () => {
    await client.close();
  });

  it("processes a real PDF file", async () => {
    const testFile = path.join(__dirname, "fixtures", "sample.pdf");

    const result = await client.ocr.processAndWait(
      testFile,
      {
        format: "structured",
        model: "standard-v1",
      },
      {
        maxWait: 60000,
      },
    );

    expect(result.status).toBe("completed");
    expect(result.pages.length).toBeGreaterThan(0);
    expect(result.pages[0].text).toBeTruthy();
  }, 120000); // 2 minute timeout

  it("handles rate limiting gracefully", async () => {
    // Submit multiple jobs quickly
    const promises = Array.from({ length: 10 }, (_, i) =>
      client.ocr.processFile(`file${i}.pdf`),
    );

    // Should not throw, retry logic handles 429
    const results = await Promise.allSettled(promises);

    const successful = results.filter((r) => r.status === "fulfilled");
    expect(successful.length).toBeGreaterThan(0);
  });

  it("cancels job successfully", async () => {
    const result = await client.ocr.processFile("file.pdf");
    await client.ocr.cancelJob(result.jobId);

    const status = await client.ocr.getJobStatus(result.jobId);
    expect(status.status).toBe("cancelled");
  });
});
```

### Test Fixtures

**Location**: `tests/fixtures/`

```
tests/fixtures/
├── sample.pdf           # Small valid PDF (1-2 pages)
├── large.pdf            # Large PDF (50+ pages)
├── scanned.pdf          # Scanned document
├── forms.pdf            # PDF with form fields
├── tables.pdf           # PDF with complex tables
├── invalid.pdf          # Corrupted file
└── expected/
    ├── sample_structured.json
    └── sample_raw.json
```

### Test Configuration

**Environment Variables**:

```bash
# Required for integration tests
LEAPOCR_API_KEY=your_test_api_key

# Optional
OCR_BASE_URL=http://localhost:8080
TEST_TIMEOUT=120000
SKIP_INTEGRATION=false
```

**CI Configuration**:

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm install

      - name: Run unit tests
        run: npm test

      - name: Run integration tests
        if: github.event_name == 'push'
        env:
          LEAPOCR_API_KEY: ${{ secrets.LEAPOCR_API_KEY }}
        run: npm run test:integration

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Implementation Checklist

### Phase 1: Setup & Generation

- [ ] **Project Structure**
  - [ ] Create repository with standard structure
  - [ ] Setup package manager (npm/poetry)
  - [ ] Configure TypeScript/Python build tools
  - [ ] Setup linting and formatting

- [ ] **OpenAPI Generation**
  - [ ] Copy `filter-sdk-endpoints.sh` script
  - [ ] Setup `openapi-generator-cli` or language-specific generator
  - [ ] Create Makefile/scripts for generation
  - [ ] Test generation with current API spec
  - [ ] Verify generated models and client

### Phase 2: Wrapper Layer

- [ ] **Core Client**
  - [ ] Implement main client class
  - [ ] Add configuration management
  - [ ] Setup HTTP client with auth
  - [ ] Add user agent with version
  - [ ] Implement close/cleanup methods

- [ ] **Retry Logic**
  - [ ] Implement exponential backoff
  - [ ] Handle 429 rate limits
  - [ ] Detect retriable vs non-retriable errors
  - [ ] Add retry configuration options
  - [ ] Add retry callbacks/logging

- [ ] **File Handling**
  - [ ] Implement file path processing
  - [ ] Implement stream/buffer processing
  - [ ] Add file validation (size, type)
  - [ ] Handle multipart upload
  - [ ] Add progress tracking for uploads

### Phase 3: OCR Service

- [ ] **Basic Operations**
  - [ ] `processFile()` - path version
  - [ ] `processFileStream()` - buffer/stream version
  - [ ] `getJobStatus()` - check status
  - [ ] `getResults()` - fetch results
  - [ ] `cancelJob()` - cancel job

- [ ] **Advanced Operations**
  - [ ] `processAndWait()` - process with polling
  - [ ] `processBatch()` - batch processing
  - [ ] `listJobs()` - list with pagination
  - [ ] Progress callbacks
  - [ ] Streaming results (optional)

### Phase 4: Error Handling

- [ ] **Error Classes**
  - [ ] Base `SDKError` class
  - [ ] `AuthenticationError`
  - [ ] `RateLimitError` with retry-after
  - [ ] `ValidationError` with field details
  - [ ] `FileError` with file context
  - [ ] `JobError` and `JobFailedError`
  - [ ] `TimeoutError`
  - [ ] `NetworkError`
  - [ ] `APIError`

- [ ] **Error Context**
  - [ ] Preserve original errors
  - [ ] Add operation context
  - [ ] Include request/response details (in debug mode)
  - [ ] Clear error messages

### Phase 5: Types & Models

- [ ] **Core Types**
  - [ ] `ProcessResult`
  - [ ] `JobStatus`
  - [ ] `JobResult`
  - [ ] `PageResult`
  - [ ] Options types (`ProcessOptions`, `PollOptions`)

- [ ] **Domain Types**
  - [ ] `TextBlock`
  - [ ] `Table` and `TableCell`
  - [ ] `FormField`
  - [ ] `BoundingBox`
  - [ ] Enums (`Format`, `Model`, `JobStatusType`)

### Phase 6: Testing

- [ ] **Unit Tests**
  - [ ] Client initialization
  - [ ] Configuration merging
  - [ ] Retry logic
  - [ ] File validation
  - [ ] Error handling
  - [ ] Polling logic
  - [ ] Mock HTTP responses

- [ ] **Integration Tests**
  - [ ] Real API processing
  - [ ] File upload
  - [ ] Job status checking
  - [ ] Results retrieval
  - [ ] Batch processing
  - [ ] Error scenarios
  - [ ] Rate limiting

- [ ] **Test Fixtures**
  - [ ] Sample PDFs (valid, invalid, large)
  - [ ] Expected responses
  - [ ] Mock server setup

### Phase 7: Documentation & Examples

- [ ] **Documentation**
  - [ ] README with quickstart
  - [ ] API reference
  - [ ] Configuration guide
  - [ ] Error handling guide
  - [ ] Migration guide (if applicable)

- [ ] **Examples**
  - [ ] Basic usage
  - [ ] Advanced options
  - [ ] Batch processing
  - [ ] Error handling
  - [ ] Progress tracking
  - [ ] Streaming (if implemented)

### Phase 8: Build & Release

- [ ] **Build System**
  - [ ] Generation scripts
  - [ ] Build/compile process
  - [ ] Bundle optimization
  - [ ] Type declarations (TS)
  - [ ] Source maps

- [ ] **Package Configuration**
  - [ ] `package.json` / `pyproject.toml`
  - [ ] Dependency versions
  - [ ] Exports/entry points
  - [ ] License
  - [ ] Repository links

- [ ] **CI/CD**
  - [ ] Automated tests
  - [ ] Linting checks
  - [ ] Coverage reporting
  - [ ] Release automation
  - [ ] Changelog generation

### Phase 9: Quality Assurance

- [ ] **Code Quality**
  - [ ] Linter passing
  - [ ] 80%+ test coverage
  - [ ] No TypeScript errors
  - [ ] Documentation complete

- [ ] **Compatibility**
  - [ ] Test on multiple language versions
  - [ ] Test on multiple platforms
  - [ ] Browser compatibility (TS only)
  - [ ] Dependency audit

- [ ] **Performance**
  - [ ] Benchmark file uploads
  - [ ] Benchmark batch processing
  - [ ] Memory usage profiling
  - [ ] Bundle size check (TS)

### Phase 10: Launch Preparation

- [ ] **Pre-Launch**
  - [ ] Internal dogfooding
  - [ ] Beta testing with users
  - [ ] Security audit
  - [ ] Performance testing at scale

- [ ] **Release**
  - [ ] Version tagging
  - [ ] Package publishing
  - [ ] Announcement
  - [ ] Monitor for issues

---

## Quick Reference Commands

### Go SDK (Reference)

```bash
# Generate SDK
make generate

# Run tests
make test
make test-integration

# Build
make build

# Examples
make examples
```

### Python SDK (Target)

```bash
# Generate SDK
python scripts/generate.py

# Run tests
pytest tests/
pytest tests/integration/ -k "test_process_file"

# Run with coverage
pytest --cov=leapocr tests/

# Format code
black leapocr/
ruff check leapocr/

# Build package
poetry build

# Publish
poetry publish
```

### TypeScript SDK (Target)

```bash
# Generate SDK
npm run generate

# Run tests
npm test
npm run test:integration

# Run with coverage
npm run test:coverage

# Lint and format
npm run lint
npm run format

# Build
npm run build

# Publish
npm publish
```

---

## Next Steps

1. **Choose Language**: Start with Python or TypeScript
2. **Setup Repository**: Use checklist above
3. **Generate Client**: Run OpenAPI generator
4. **Build Wrapper**: Implement core client and OCR service
5. **Add Tests**: Unit tests first, then integration
6. **Document**: README and examples
7. **Release**: Alpha/beta versions for testing

**Key Success Metrics**:

- ✅ Generated code never manually edited
- ✅ Wrapper provides idiomatic API
- ✅ 80%+ test coverage
- ✅ All examples work out of the box
- ✅ Clear error messages
- ✅ Easy to regenerate from updated spec

---

_Generated from Go SDK analysis - commit `2a63a67`_
