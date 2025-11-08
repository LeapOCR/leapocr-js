# LeapOCR SDK - Validation & Error Handling Examples

This package demonstrates validation and error handling patterns for the LeapOCR JavaScript/TypeScript SDK.

## Features Demonstrated

- Input validation (API keys, file paths, URLs)
- Error type checking and handling
- Timeout configuration and handling
- AbortSignal for request cancellation
- Network error handling
- Authentication error handling

## Prerequisites

1. LeapOCR API key (set as environment variable)
2. Node.js 18+ or compatible runtime

## Setup

```bash
# Install dependencies (from monorepo root)
pnpm install

# Set your API key
export LEAPOCR_API_KEY="your-api-key-here"

# Optional: Set custom base URL
export LEAPOCR_BASE_URL="http://localhost:8080/api/v1"
```

## Running the Examples

```bash
# Run the examples
pnpm start

# Run in watch mode
pnpm dev
```

## Example Code

### Input Validation

```typescript
// Empty API key - throws error
try {
  new LeapOCR({ apiKey: "" });
} catch (error) {
  console.log("Empty API key rejected:", error);
}

// Invalid URL - throws ValidationError
try {
  await client.ocr.uploadFromURL("not-a-valid-url");
} catch (error) {
  if (error instanceof ValidationError) {
    console.log("Invalid URL:", error.message);
  }
}

// Non-existent file - throws FileError
try {
  await client.ocr.uploadFile("/path/to/missing.pdf");
} catch (error) {
  console.log("File not found:", error);
}
```

### Error Type Handling

```typescript
import {
  NetworkError,
  AuthenticationError,
  ValidationError,
  TimeoutError,
  SDKError,
} from "@leapocr/sdk";

try {
  await client.ocr.uploadFromURL(invalidURL);
} catch (error) {
  if (error instanceof NetworkError) {
    console.log("Network error - check connectivity");
  } else if (error instanceof AuthenticationError) {
    console.log("Invalid API key");
  } else if (error instanceof ValidationError) {
    console.log("Invalid input:", error.message);
  } else if (error instanceof TimeoutError) {
    console.log(`Job ${error.jobId} timed out`);
  } else if (error instanceof SDKError) {
    console.log("SDK error:", error.message);
  }
}
```

### Timeout Handling

```typescript
// Short HTTP timeout
const client = new LeapOCR({
  apiKey: "your-key",
  timeout: 5000, // 5 seconds
});

// Polling timeout
try {
  await client.ocr.waitForCompletion(jobId, {
    pollInterval: 2000,
    maxWait: 60000, // 60 seconds max
  });
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log(`Polling timed out for job ${error.jobId}`);
  }
}
```

### AbortSignal for Cancellation

```typescript
const controller = new AbortController();

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  const job = await client.ocr.uploadFromURL(url, {
    format: "markdown",
    signal: controller.signal,
  });

  await client.ocr.waitForCompletion(job.jobId, {
    signal: controller.signal,
  });
} catch (error) {
  if (error.name === "AbortError") {
    console.log("Request cancelled");
  }
}
```

## Error Types

### NetworkError

Thrown for network-related errors (DNS failures, connection timeouts, etc.)

### AuthenticationError

Thrown for invalid or missing API keys (HTTP 401)

### AuthorizationError

Thrown for insufficient permissions (HTTP 403)

### ValidationError

Thrown for invalid input data (HTTP 400, 422)

### RateLimitError

Thrown when rate limits are exceeded (HTTP 429)

### TimeoutError

Thrown when polling exceeds `maxWait` duration

### FileError

Thrown for file-related errors (not found, unsupported type, too large)

### JobFailedError

Thrown when OCR processing fails

### SDKError

Base class for all SDK errors

## Validation Rules

### File Validation

- **Supported formats**: PDF, PNG, JPG, JPEG, TIFF, TIF, WEBP
- **Max file size**: 50 MB
- **File must exist** and be readable

### URL Validation

- Must be valid HTTP/HTTPS URL
- Must be accessible from API server

### API Key Validation

- Cannot be empty
- Must be valid format

## See Also

- [Basic Examples](../basic/) - Simple file processing
- [Advanced Examples](../advanced/) - Batch processing, schemas
- [SDK Documentation](../../packages/sdk/)
