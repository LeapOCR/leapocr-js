# LeapOCR JavaScript SDK

[![npm version](https://img.shields.io/npm/v/leapocr.svg)](https://www.npmjs.com/package/leapocr)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

Official JavaScript/TypeScript SDK for [LeapOCR](https://www.leapocr.com/) - Transform documents into structured data using AI-powered OCR.

## Overview

LeapOCR provides enterprise-grade document processing with AI-powered data extraction. This SDK offers a JavaScript/TypeScript-native interface for seamless integration into your Node.js and browser applications.

## Installation

```bash
npm install leapocr
# or
yarn add leapocr
# or
pnpm add leapocr
```

## Quick Start

### Prerequisites

- Node.js 18 or higher
- LeapOCR API key ([sign up here](https://www.leapocr.com/signup))

### Basic Example

```typescript
import { LeapOCR } from "leapocr";

// Initialize the SDK with your API key
const client = new LeapOCR({
  apiKey: process.env.LEAPOCR_API_KEY,
});

// Submit a document for processing
const job = await client.ocr.processURL("https://example.com/document.pdf", {
  format: "structured",
  model: "standard-v1",
});

// Wait for processing to complete
const result = await client.ocr.waitUntilDone(job.jobId);

console.log("Extracted data:", result.data);
```

## Key Features

- **TypeScript First** - Full type safety with comprehensive TypeScript definitions
- **Multiple Processing Formats** - Structured data extraction, markdown output, or per-page processing
- **Flexible Model Selection** - Choose from standard, pro, or custom AI models
- **Custom Schema Support** - Define extraction schemas for your specific use case
- **Built-in Retry Logic** - Automatic handling of transient failures
- **Universal Runtime** - Works in Node.js and modern browsers
- **Direct File Upload** - Efficient multipart uploads for local files

## Processing Models

| Model            | Use Case                           | Credits/Page | Priority |
| ---------------- | ---------------------------------- | ------------ | -------- |
| `standard-v1`    | General purpose (default)          | 1            | 1        |
| `english-pro-v1` | English documents, premium quality | 2            | 4        |
| `pro-v1`         | Highest quality, all languages     | 5            | 5        |

Specify a model in the processing options. Defaults to `standard-v1`.

## Usage Examples

### Processing from URL

```typescript
const client = new LeapOCR({
  apiKey: process.env.LEAPOCR_API_KEY,
});

const job = await client.ocr.processURL("https://example.com/invoice.pdf", {
  format: "structured",
  model: "standard-v1",
  instructions: "Extract invoice number, date, and total amount",
});

const result = await client.ocr.waitUntilDone(job.jobId);

console.log(`Processing completed in ${result.processing_time_seconds}s`);
console.log(`Credits used: ${result.credits_used}`);
console.log("Data:", result.data);
```

### Processing Local Files

```typescript
import { readFileSync } from "fs";

const client = new LeapOCR({
  apiKey: process.env.LEAPOCR_API_KEY,
});

const job = await client.ocr.processFile("./invoice.pdf", {
  format: "structured",
  model: "pro-v1",
  schema: {
    invoice_number: "string",
    total_amount: "number",
    invoice_date: "string",
    vendor_name: "string",
  },
});

const result = await client.ocr.waitUntilDone(job.jobId);
console.log("Extracted data:", result.data);
```

### Custom Schema Extraction

```typescript
const schema = {
  type: "object",
  properties: {
    patient_name: { type: "string" },
    date_of_birth: { type: "string" },
    medications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          dosage: { type: "string" },
        },
      },
    },
  },
};

const job = await client.ocr.processFile("./medical-record.pdf", {
  format: "structured",
  schema,
});
```

### Output Formats

| Format                | Description        | Use Case                                       |
| --------------------- | ------------------ | ---------------------------------------------- |
| `structured`          | Single JSON object | Extract specific fields across entire document |
| `markdown`            | Text per page      | Convert document to readable text              |
| `per-page-structured` | JSON per page      | Extract fields from multi-section documents    |

### Monitoring Job Progress

```typescript
// Poll for status updates
const pollInterval = 2000; // 2 seconds
const maxAttempts = 150; // 5 minutes max
let attempts = 0;

while (attempts < maxAttempts) {
  const status = await client.ocr.getJobStatus(job.jobId);

  console.log(
    `Status: ${status.status} (${status.progress?.toFixed(1)}% complete)`,
  );

  if (status.status === "completed") {
    const result = await client.ocr.getJobResult(job.jobId);
    console.log("Processing complete!");
    break;
  }

  await new Promise((resolve) => setTimeout(resolve, pollInterval));
  attempts++;
}
```

### Using Template Slugs

```typescript
// Process a document using a predefined template
const job = await client.ocr.processFile("./invoice.pdf", {
  templateSlug: "my-invoice-template",
  model: "pro-v1",
});

const result = await client.ocr.waitUntilDone(job.jobId);
console.log("Extracted data:", result.data);
```

### Deleting Jobs

```typescript
// Delete a completed job to free up resources
await client.ocr.deleteJob(job.jobId);
console.log("Job deleted successfully");
```

For more examples, see the [`examples/`](../../examples) directory.

## Configuration

### Custom Configuration

```typescript
import { LeapOCR } from "leapocr";

const client = new LeapOCR({
  apiKey: "your-api-key",
  baseURL: "https://api.leapocr.com", // optional
  timeout: 30000, // 30 seconds (optional)
});
```

### Environment Variables

```bash
export LEAPOCR_API_KEY="your-api-key"
export LEAPOCR_BASE_URL="https://api.leapocr.com"  # optional
```

## Error Handling

The SDK provides typed errors for robust error handling:

```typescript
import {
  AuthenticationError,
  ValidationError,
  JobFailedError,
  TimeoutError,
  NetworkError,
} from "leapocr";

try {
  const result = await client.ocr.waitUntilDone(job.jobId);
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error("Authentication failed - check your API key");
  } else if (error instanceof ValidationError) {
    console.error("Validation error:", error.message);
  } else if (error instanceof NetworkError) {
    // Retry the operation
    console.error("Network error, retrying...");
  } else if (error instanceof JobFailedError) {
    console.error("Processing failed:", error.message);
  } else if (error instanceof TimeoutError) {
    console.error("Operation timed out");
  }
}
```

### Error Types

- `AuthenticationError` - Invalid API key or authentication failures
- `AuthorizationError` - Permission denied for requested resource
- `RateLimitError` - API rate limit exceeded
- `ValidationError` - Input validation errors
- `FileError` - File-related errors (size, format, etc.)
- `JobError` - Job processing errors
- `JobFailedError` - Job completed with failure status
- `TimeoutError` - Operation timeouts
- `NetworkError` - Network/connectivity issues (retryable)
- `APIError` - General API errors

## API Reference

Full API documentation is available in the [TypeScript definitions](./src/types/).

### Core Methods

```typescript
// Initialize SDK
new LeapOCR(config: ClientConfig)

// Process documents
client.ocr.processURL(url: string, options?: UploadOptions): Promise<UploadResult>
client.ocr.processFile(filePath: string, options?: UploadOptions): Promise<UploadResult>
client.ocr.processBuffer(buffer: Buffer, filename: string, options?: UploadOptions): Promise<UploadResult>

// Job management
client.ocr.getJobStatus(jobId: string): Promise<JobStatus>
client.ocr.getJobResult(jobId: string): Promise<OCRResult>
client.ocr.waitUntilDone(jobId: string, options?: PollOptions): Promise<OCRResult>
client.ocr.deleteJob(jobId: string): Promise<void>
```

### Processing Options

```typescript
interface UploadOptions {
  format?: "structured" | "markdown" | "per-page-structured";
  model?: OCRModel;
  schema?: Record<string, any>;
  instructions?: string;
  templateSlug?: string;
}
```

## Development

### Prerequisites

- Node.js 18+
- pnpm 9+

### Setup

```bash
# Install dependencies
pnpm install

# Build the SDK
pnpm build
```

### Common Tasks

```bash
pnpm build              # Build the SDK
pnpm test               # Run unit tests
pnpm typecheck          # Type check
pnpm format             # Format code
pnpm dev                # Development mode with watch
pnpm generate           # Generate types from OpenAPI spec
```

## Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for detailed guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## Support & Resources

- **Documentation**: [docs.leapocr.com](https://docs.leapocr.com)
- **NPM Package**: [npmjs.com/package/leapocr](https://www.npmjs.com/package/leapocr)
- **Issues**: [GitHub Issues](https://github.com/leapocr/leapocr-js/issues)
- **Website**: [leapocr.com](https://www.leapocr.com)

---

**Version**: 0.0.5
