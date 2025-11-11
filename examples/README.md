# LeapOCR SDK Examples

This directory contains comprehensive examples demonstrating how to use the LeapOCR JavaScript/TypeScript SDK.

## Available Examples

### 📄 [Basic Examples](./basic/)

Simple, straightforward examples for getting started:

- Processing local PDF files
- Processing files from URLs
- Waiting for job completion
- Getting job status and results
- Manual polling for status updates

**Best for**: First-time users, quick start guides

### 🚀 [Advanced Examples](./advanced/)

Advanced usage patterns and features:

- Custom SDK configuration
- Concurrent batch processing
- Schema-based data extraction
- Progress tracking during processing
- Error handling in batch operations

**Best for**: Production applications, complex workflows

### ✅ [Validation Examples](./validation/)

Input validation and error handling:

- Input validation patterns
- Error type checking
- Timeout configuration
- AbortSignal for cancellation
- Network and authentication errors

**Best for**: Robust error handling, production-ready code

## Quick Start

### Prerequisites

1. **Node.js 18+** or compatible runtime
2. **LeapOCR API Key** - Get yours from [LeapOCR Dashboard](https://leapocr.com)

### Setup

```bash
# 1. Install dependencies (from monorepo root)
cd leapocr-js
pnpm install

# 2. Set your API key
export LEAPOCR_API_KEY="your-api-key-here"

# 3. Optional: Set custom base URL (for local development)
export LEAPOCR_BASE_URL="http://localhost:8080/api/v1"

# 4. Run any example
cd examples/basic
pnpm start
```

## Running Examples

Each example directory has its own package with scripts:

```bash
# Run the example once
pnpm start

# Run in watch mode (auto-restart on changes)
pnpm dev
```

## Example Structure

Each example package includes:

```
example-name/
├── index.ts          # Main example code
├── package.json      # Package configuration
├── tsconfig.json     # TypeScript configuration
└── README.md         # Example-specific documentation
```

## Common Patterns

### Processing a Local File

```typescript
import { LeapOCR } from "@leapocr/sdk";

const client = new LeapOCR({
  apiKey: process.env.LEAPOCR_API_KEY,
});

// Upload and wait for completion
const result = await client.ocr.processFile(
  "./document.pdf",
  {
    format: "structured",
    model: "standard-v1",
    instructions: "Extract invoice details",
  },
  {
    pollInterval: 2000,
    maxWait: 300000,
  }
);

console.log(result.pages);
```

### Processing from URL

```typescript
const job = await client.ocr.uploadFromURL("https://example.com/document.pdf", {
  format: "markdown",
  model: "standard-v1",
});

const result = await client.ocr.waitForCompletion(job.jobId);
const fullResult = await client.ocr.getJobResult(job.jobId);
```

### Batch Processing

```typescript
const files = ["file1.pdf", "file2.pdf", "file3.pdf"];

const uploadPromises = files.map((file) =>
  client.ocr.uploadFile(file, {
    format: "structured",
    model: "standard-v1",
  })
);

const jobs = await Promise.all(uploadPromises);

// Wait for all to complete
const results = await Promise.all(
  jobs.map((job) => client.ocr.waitForCompletion(job.jobId))
);
```

## SDK Configuration

### Basic Configuration

```typescript
const client = new LeapOCR({
  apiKey: "your-api-key",
});
```

### Advanced Configuration

```typescript
const client = new LeapOCR({
  apiKey: "your-api-key",
  baseURL: "https://api.leapocr.com/api/v1",
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  retryMultiplier: 2,
  debug: true,
});
```

## Available Options

### Upload Options

```typescript
{
  format: "markdown" | "structured" | "per_page_structured",
  model: "standard-v1" | "english-pro-v1" | "pro-v1",
  instructions: "Optional instructions for extraction",
  schema: { /* JSON Schema for structured extraction */ },
  templateId: "template-id-for-reusable-schemas",
  signal: abortController.signal,
}
```

### Polling Options

```typescript
{
  pollInterval: 2000,      // Poll every 2 seconds
  maxWait: 300000,         // Max 5 minutes
  onProgress: (status) => {
    console.log(status.status, status.progress);
  },
  signal: abortController.signal,
}
```

## Available Formats

| Format                | Description                    | Output                                 |
| --------------------- | ------------------------------ | -------------------------------------- |
| `markdown`            | Page-by-page OCR               | Plain text per page                    |
| `structured`          | Structured data extraction     | JSON data based on schema/instructions |
| `per_page_structured` | Per-page structured extraction | Structured data for each page          |

## Error Handling

All examples demonstrate proper error handling:

```typescript
import {
  NetworkError,
  AuthenticationError,
  ValidationError,
  TimeoutError,
} from "@leapocr/sdk";

try {
  const result = await client.ocr.processFile("file.pdf");
} catch (error) {
  if (error instanceof NetworkError) {
    console.error("Network error:", error.message);
  } else if (error instanceof AuthenticationError) {
    console.error("Invalid API key");
  } else if (error instanceof ValidationError) {
    console.error("Invalid input:", error.message);
  } else if (error instanceof TimeoutError) {
    console.error(`Job ${error.jobId} timed out`);
  }
}
```

## Environment Variables

| Variable           | Required | Default                          | Description          |
| ------------------ | -------- | -------------------------------- | -------------------- |
| `LEAPOCR_API_KEY`  | Yes      | -                                | Your LeapOCR API key |
| `LEAPOCR_BASE_URL` | No       | `https://api.leapocr.com/api/v1` | API base URL         |

## Troubleshooting

### API Key Not Set

```
Error: API key is required
```

**Solution**: Set the `LEAPOCR_API_KEY` environment variable

### File Not Found

```
Error: File not found: ./document.pdf
```

**Solution**: Ensure the file path is correct and the file exists

### Timeout Errors

```
Error: Job abc123 timed out after 300000ms
```

**Solution**: Increase `maxWait` option or check job status manually

### Network Errors

```
Error: Network error: getaddrinfo ENOTFOUND
```

**Solution**: Check internet connectivity and `LEAPOCR_BASE_URL`

## Support

- [SDK Documentation](../packages/sdk/README.md)
- [API Documentation](https://docs.leapocr.com)
- [GitHub Issues](https://github.com/leapocr/leapocr-js/issues)

## License

MIT
