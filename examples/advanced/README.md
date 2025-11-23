# LeapOCR SDK - Advanced Examples

This package demonstrates advanced usage patterns of the LeapOCR JavaScript/TypeScript SDK.

## Features Demonstrated

- Custom SDK configuration
- Concurrent batch processing with Promise.all
- Schema-based data extraction
- Progress tracking during processing
- Error handling in batch operations

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
export LEAPOCR_BASE_URL="http://localhost:8443/api/v1"
```

## Running the Examples

```bash
# Run the examples
pnpm start

# Run in watch mode
pnpm dev
```

## Example Code

### Custom Configuration

```typescript
const client = new LeapOCR({
  apiKey: "your-api-key",
  baseURL: "https://api-staging.leapocr.com/api/v1",
  timeout: 60000,
  maxRetries: 5,
  retryDelay: 2000,
  retryMultiplier: 2,
  debug: true,
});
```

### Concurrent Batch Processing

```typescript
const fileURLs = [
  "https://example.com/doc1.pdf",
  "https://example.com/doc2.pdf",
  "https://example.com/doc3.pdf",
];

const uploadPromises = fileURLs.map(async (url, index) => {
  const job = await client.ocr.uploadFromURL(url, {
    format: "structured",
    model: "standard-v1",
  });

  return client.ocr.waitForCompletion(job.jobId, {
    pollInterval: 2000,
    maxWait: 300000,
    onProgress: (status) => {
      console.log(`File ${index + 1}: ${status.status}`);
    },
  });
});

const results = await Promise.all(uploadPromises);
```

### Schema-Based Extraction

```typescript
const invoiceSchema = {
  type: "object",
  properties: {
    invoice_number: {
      type: "string",
      description: "The invoice number",
    },
    total_amount: {
      type: "number",
      description: "The total amount",
    },
    vendor_name: {
      type: "string",
      description: "The vendor name",
    },
    line_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unit_price: { type: "number" },
        },
      },
    },
  },
  required: ["invoice_number", "total_amount"],
};

const job = await client.ocr.uploadFromURL(invoiceURL, {
  format: "structured",
  model: "pro-v1",
  schema: invoiceSchema,
  instructions: "Extract invoice data according to schema",
});
```

## Advanced Patterns

### Progress Tracking

Track processing progress with callbacks:

```typescript
await client.ocr.waitForCompletion(jobId, {
  pollInterval: 2000,
  maxWait: 300000,
  onProgress: (status) => {
    console.log(`Status: ${status.status}`);
    if (status.progress) {
      console.log(`Progress: ${status.progress.toFixed(1)}%`);
    }
  },
});
```

### Retry Configuration

Configure custom retry behavior:

```typescript
const client = new LeapOCR({
  apiKey: "your-api-key",
  maxRetries: 5,
  retryDelay: 1000,
  retryMultiplier: 2, // Exponential backoff
});
```

## See Also

- [Basic Examples](../basic/) - Simple file processing
- [Validation Examples](../validation/) - Error handling
- [SDK Documentation](../../packages/sdk/)
