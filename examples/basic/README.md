# LeapOCR SDK - Basic Examples

This package demonstrates basic usage of the LeapOCR JavaScript/TypeScript SDK.

## Features Demonstrated

- Processing local PDF files
- Processing files from URLs
- Waiting for job completion
- Getting job status and results
- Manual polling for status updates

## Prerequisites

1. LeapOCR API key (set as environment variable)
2. Node.js 18+ or compatible runtime

## Setup

```bash
# Install dependencies (from monorepo root)
pnpm install

# Set your API key
export LEAPOCR_API_KEY="your-api-key-here"

# Optional: Set custom base URL (defaults to https://api.leapocr.com/api/v1)
export LEAPOCR_BASE_URL="http://localhost:8080/api/v1"
```

## Running the Examples

```bash
# Run the examples
pnpm start

# Run in watch mode (auto-restart on changes)
pnpm dev
```

## Example Code

### Processing a Local File

```typescript
const client = new LeapOCR({
  apiKey: process.env.LEAPOCR_API_KEY,
});

const job = await client.ocr.uploadFile("./document.pdf", {
  format: "structured",
  model: "standard-v1",
  instructions: "Extract invoice details",
});

const result = await client.ocr.waitForCompletion(job.jobId);
const fullResult = await client.ocr.getJobResult(job.jobId);
console.log(fullResult.pages);
```

### Processing a File from URL

```typescript
const job = await client.ocr.uploadFromURL("https://example.com/document.pdf", {
  format: "markdown",
  model: "standard-v1",
});

// Manual polling
while (true) {
  const status = await client.ocr.getJobStatus(job.jobId);
  if (status.status === "completed") {
    const result = await client.ocr.getJobResult(job.jobId);
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
```

## Available Models

- `standard-v1` - Standard OCR model
- `english-pro-v1` - Enhanced English OCR
- `pro-v1` - Highest quality OCR

## Available Formats

- `markdown` - Page-by-page OCR output
- `structured` - Structured data extraction
- `per_page_structured` - Per-page structured extraction

## See Also

- [Advanced Examples](../advanced/) - Batch processing, custom schemas
- [Validation Examples](../validation/) - Error handling, input validation
- [SDK Documentation](../../packages/sdk/)
