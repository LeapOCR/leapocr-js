# LeapOCR JavaScript/TypeScript SDK

Official JavaScript/TypeScript SDK for the [LeapOCR](https://leapocr.com) API - Fast, accurate document OCR and data extraction.

## Features

- ✨ **Simple & Intuitive** - Clean, idiomatic JavaScript/TypeScript API
- 🔄 **Auto-Retry** - Built-in exponential backoff for transient errors
- ⏱️ **Polling Helpers** - Convenience methods for async job management
- 📦 **Multiple Upload Methods** - File path, Buffer, Stream, or URL
- 🎯 **TypeScript First** - Full type safety and IntelliSense support
- 🚀 **Batch Processing** - Process multiple files with concurrency control
- 🛡️ **Comprehensive Error Handling** - Typed errors for better error handling
- 🔍 **File Validation** - Client-side validation before upload

## Installation

```bash
# Using pnpm
pnpm add @leapocr/sdk

# Using npm
npm install @leapocr/sdk

# Using yarn
yarn add @leapocr/sdk
```

## Quick Start

```typescript
import { LeapOCR } from '@leapocr/sdk';

// Initialize client
const client = new LeapOCR('your-api-key');

// Process a document (upload + poll until complete)
const result = await client.ocr.processFile('./document.pdf', {
  model: 'standard-v1',
}, {
  onProgress: (status) => {
    console.log(`Progress: ${status.progress}%`);
  },
});

console.log('Extracted text:', result.pages[0].text);
```

## Authentication

Get your API key from the [LeapOCR Dashboard](https://leapocr.com/dashboard).

```typescript
const client = new LeapOCR('your-api-key');

// Or with environment variable
const client = new LeapOCR(process.env.LEAPOCR_API_KEY);
```

## Usage Examples

### Simple File Upload

```typescript
// Upload and wait for completion
const result = await client.ocr.processFile('./document.pdf');
console.log(result.pages[0].text);
```

### Upload with Progress Tracking

```typescript
const result = await client.ocr.processFile(
  './document.pdf',
  { model: 'standard-v1' },
  {
    pollInterval: 2000,
    maxWait: 300000,
    onProgress: (status) => {
      console.log(`Progress: ${status.progress}%`);
    },
  }
);
```

### Batch Processing

```typescript
const files = ['./doc1.pdf', './doc2.pdf', './doc3.pdf'];

const batch = await client.ocr.processBatch(files, {
  model: 'standard-v1',
  concurrency: 5,
});

console.log(`Uploaded ${batch.jobs.length}/${batch.totalFiles} files`);
```

### Error Handling

```typescript
import { AuthenticationError, RateLimitError, FileError } from '@leapocr/sdk';

try {
  const result = await client.ocr.processFile('./document.pdf');
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof FileError) {
    console.error(`File error: ${error.message}`);
  }
}
```

## API Reference

See [`examples/`](../../examples/) for more detailed examples.

## Development

```bash
# Install dependencies
pnpm install

# Generate types from OpenAPI
pnpm run generate

# Build
pnpm run build

# Test
pnpm test
```

## Support

- 📧 Email: support@leapocr.com
- 🐛 Issues: [GitHub Issues](https://github.com/leapocr/leapocr-js/issues)
- 📖 Docs: [LeapOCR Documentation](https://docs.leapocr.com)

## License

MIT © LeapOCR
