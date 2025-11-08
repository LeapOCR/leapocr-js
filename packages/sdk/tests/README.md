# LeapOCR SDK Tests

This directory contains comprehensive tests for the LeapOCR JavaScript/TypeScript SDK.

## Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── validation.test.ts   # File and buffer validation tests
│   ├── retry.test.ts        # Retry logic and exponential backoff tests
│   └── polling.test.ts      # Polling and timeout tests
├── integration/             # Integration tests (requires running API)
│   └── ocr.integration.test.ts
└── fixtures/                # Test files
    ├── sample.pdf
    ├── sample.png
    └── README.md
```

## Running Tests

### Unit Tests

Unit tests run without requiring an API server:

```bash
pnpm test
```

### Integration Tests

Integration tests require a running LeapOCR API server. Set these environment variables:

```bash
export LEAPOCR_API_KEY="your-api-key"
export LEAPOCR_BASE_URL="http://localhost:8080/api/v1"  # optional, defaults to this
pnpm test
```

Without the API key, integration tests will be skipped automatically.

### Test Coverage

Generate coverage reports:

```bash
pnpm test --coverage
```

Coverage reports will be generated in the `coverage/` directory.

## Test Categories

### Validation Tests (22 tests)

Tests for file and buffer validation:

- File extension validation (.pdf, .png, .jpg, .jpeg, .tiff, .tif, .webp)
- File size validation
- Directory detection
- File existence checks
- Buffer validation
- Content type validation

### Retry Logic Tests (29 tests)

Tests for error handling and retry mechanisms:

- Retriable error detection (5xx, 429, 408, network errors)
- Non-retriable error detection (4xx except 408/429)
- Exponential backoff calculation
- Jitter application
- Retry-After header handling
- Max retries enforcement
- Custom retry options

### Polling Tests (13 tests)

Tests for polling operations:

- Poll until condition met
- Progress callbacks
- Timeout handling
- AbortSignal support
- Delay adjustment near maxWait
- Complex condition logic
- Error propagation

### Integration Tests (19 tests - skipped without API)

End-to-end tests with real API:

- File uploads (PDF, PNG, various formats)
- Buffer uploads
- Stream uploads
- URL uploads
- Job status tracking
- Waiting for completion
- Result retrieval
- Pagination
- Concurrent operations
- Error scenarios

## Test Fixtures

Test fixtures are located in `tests/fixtures/`:

- `sample.pdf` - Minimal valid PDF with "Hello World" text
- `sample.png` - 1x1 transparent PNG image

These files are used by tests to validate upload functionality. Do not modify or delete them.

## Writing New Tests

### Unit Test Template

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("Feature Name", () => {
  beforeEach(() => {
    // Setup
  });

  it("should do something", () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});
```

### Integration Test Template

```typescript
describe.skipIf(!runIntegrationTests)("Feature Integration", () => {
  it("should work end-to-end", async () => {
    // Integration test with real API
  }, 30000); // Longer timeout for API calls
});
```

## CI/CD

Tests run automatically in CI with:

- Unit tests on every commit
- Integration tests only when API credentials are available
- Coverage reports generated and uploaded

## Debugging Tests

Run tests in watch mode:

```bash
pnpm vitest
```

Run specific test file:

```bash
pnpm vitest tests/unit/validation.test.ts
```

Run with verbose output:

```bash
pnpm vitest --reporter=verbose
```

## Test Results

Current test results (without integration tests):

- ✓ Validation: 22/22 tests passing
- ✓ Retry Logic: 29/29 tests passing
- ✓ Polling: 13/13 tests passing
- ↓ Integration: 19 tests (skipped without API)

**Total: 64 passing, 19 skipped**

## Known Issues

- Vitest may show "PromiseRejectionHandledWarning" for async error tests - this is normal and expected behavior for `expect().rejects` assertions
- Integration tests require manual API server setup and are skipped in CI unless credentials are provided
