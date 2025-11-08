import { LeapOCR } from "@leapocr/sdk";
import {
  AuthenticationError,
  ValidationError,
  NetworkError,
  TimeoutError,
  SDKError,
} from "@leapocr/sdk";

/**
 * Validation and error handling examples for LeapOCR SDK
 *
 * Demonstrates:
 * - Input validation
 * - Error handling and error types
 * - Timeout handling
 *
 * Set LEAPOCR_API_KEY environment variable before running:
 * export LEAPOCR_API_KEY="your-api-key"
 *
 * Run with: pnpm start
 */

async function main() {
  const apiKey = process.env.LEAPOCR_API_KEY;
  if (!apiKey) {
    console.error("LEAPOCR_API_KEY environment variable is required");
    process.exit(1);
  }

  // Example: Input validation
  try {
    await inputValidationExample(apiKey);
  } catch (error) {
    console.error("Input validation example failed:", error);
  }

  // Example: Error handling
  try {
    await errorHandlingExample(apiKey);
  } catch (error) {
    console.error("Error handling example failed:", error);
  }

  // Example: Timeout handling
  try {
    await timeoutHandlingExample(apiKey);
  } catch (error) {
    console.error("Timeout handling example failed:", error);
  }
}

async function inputValidationExample(apiKey: string) {
  console.log("=== Input Validation Example ===");

  // Test creating SDK with empty API key (should fail)
  console.log("1. Testing empty API key...");
  try {
    new LeapOCR({ apiKey: "" });
    console.log("[FAIL] Should have rejected empty API key");
  } catch (error) {
    console.log(`[PASS] Correctly rejected empty API key: ${error}`);
  }

  // Test creating SDK with valid configuration
  console.log("2. Testing valid configuration...");
  try {
    const client = new LeapOCR({
      apiKey,
      baseURL: process.env.LEAPOCR_BASE_URL,
    });
    console.log("[PASS] SDK created successfully");

    // Test invalid URL processing
    console.log("3. Testing invalid URL...");
    try {
      await client.ocr.processURL("not-a-valid-url", {
        format: "structured",
      });
      console.log("[FAIL] Should have rejected invalid URL");
    } catch (error) {
      console.log(`[PASS] Correctly rejected invalid URL: ${error}`);
    }

    // Test non-existent file
    console.log("4. Testing non-existent file...");
    try {
      await client.ocr.processFile("/path/to/nonexistent/file.pdf");
      console.log("[FAIL] Should have rejected non-existent file");
    } catch (error) {
      console.log(`[PASS] Correctly rejected non-existent file: ${error}`);
    }

    // Test unsupported file type
    console.log("5. Testing unsupported file type...");
    try {
      await client.ocr.processFile("./package.json");
      console.log("[FAIL] Should have rejected unsupported file type");
    } catch (error) {
      console.log(`[PASS] Correctly rejected unsupported file type: ${error}`);
    }
  } catch (error) {
    console.error("Failed to create SDK:", error);
  }

  console.log();
}

async function errorHandlingExample(apiKey: string) {
  console.log("=== Error Handling Example ===");

  const client = new LeapOCR({
    apiKey,
    baseURL: process.env.LEAPOCR_BASE_URL,
  });

  // Test processing with invalid URL (will likely fail)
  console.log("1. Testing error handling for invalid processing...");
  try {
    await client.ocr.processURL(
      "https://nonexistent-domain-12345.com/fake.pdf",
      {
        format: "structured",
      },
    );
    console.log("[FAIL] Should have failed with network error");
  } catch (error) {
    // Demonstrate error type checking
    if (error instanceof NetworkError) {
      console.log("[PASS] Received NetworkError");
      console.log(`  Message: ${error.message}`);
    } else if (error instanceof ValidationError) {
      console.log("[PASS] Received ValidationError");
      console.log(`  Message: ${error.message}`);
    } else if (error instanceof AuthenticationError) {
      console.log("[PASS] Received AuthenticationError");
      console.log(`  Message: ${error.message}`);
    } else if (error instanceof SDKError) {
      console.log("[PASS] Received SDKError");
      console.log(`  Message: ${error.message}`);
    } else {
      console.log(`[PASS] Received generic error: ${error}`);
    }
  }

  // Test getting status for non-existent job
  console.log("2. Testing error handling for non-existent job...");
  try {
    await client.ocr.getJobStatus("non-existent-job-id-12345");
    console.log("[FAIL] Should have failed with not found error");
  } catch (error) {
    console.log(`[PASS] Correctly handled non-existent job: ${error}`);
  }

  // Test authentication error with invalid API key
  console.log("3. Testing authentication error...");
  try {
    const invalidClient = new LeapOCR({
      apiKey: "invalid-api-key-12345",
      baseURL: process.env.LEAPOCR_BASE_URL,
    });

    await invalidClient.ocr.processURL(
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      { format: "markdown" },
    );
    console.log("[FAIL] Should have failed with authentication error");
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.log("[PASS] Received AuthenticationError");
      console.log(`  Message: ${error.message}`);
    } else {
      console.log(`[PASS] Received error: ${error}`);
    }
  }

  console.log();
}

async function timeoutHandlingExample(apiKey: string) {
  console.log("=== Timeout Handling Example ===");

  // Test with very short timeout (should fail quickly)
  console.log("1. Testing short HTTP timeout...");
  const shortTimeoutClient = new LeapOCR({
    apiKey,
    baseURL: process.env.LEAPOCR_BASE_URL,
    timeout: 100, // 100ms - very short
  });

  const start = Date.now();
  try {
    await shortTimeoutClient.ocr.processURL(
      "https://httpbin.org/delay/2", // Delayed response
      { format: "structured" },
    );
    console.log("[FAIL] Expected timeout");
  } catch (error) {
    const duration = Date.now() - start;
    if (error instanceof NetworkError || error instanceof SDKError) {
      console.log(
        `[PASS] Correctly timed out after ${duration}ms: ${error.message}`,
      );
    } else {
      console.log(`[PASS] Failed quickly (${duration}ms): ${error}`);
    }
  }

  // Test custom wait options with short timeout
  console.log("2. Testing polling timeout...");
  const normalClient = new LeapOCR({
    apiKey,
    baseURL: process.env.LEAPOCR_BASE_URL,
  });

  // Create a job and test waiting with very short timeout
  try {
    const job = await normalClient.ocr.processURL(
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      {
        format: "markdown",
        model: "standard-v1",
      },
    );

    console.log(`Job created: ${job.jobId}`);

    // Wait with very short timeout (will likely fail)
    const waitStart = Date.now();
    try {
      await normalClient.ocr.waitUntilDone(job.jobId, {
        pollInterval: 100,
        maxWait: 500, // Very short timeout
      });
      console.log("[FAIL] Expected timeout error");
    } catch (error) {
      const waitDuration = Date.now() - waitStart;
      if (error instanceof TimeoutError) {
        console.log(`[PASS] Correctly timed out after ${waitDuration}ms`);
        console.log(`  Job ID: ${error.jobId}`);
        console.log(`  Message: ${error.message}`);
      } else {
        console.log(`[PASS] Wait failed after ${waitDuration}ms: ${error}`);
      }
    }
  } catch (error) {
    console.log(`[INFO] Could not create job for timeout test: ${error}`);
  }

  // Test AbortSignal for cancellation
  console.log("3. Testing AbortSignal cancellation...");
  try {
    const controller = new AbortController();

    const job = await normalClient.ocr.processURL(
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      {
        format: "markdown",
        model: "standard-v1",
        signal: controller.signal,
      },
    );

    // Abort after 1 second
    setTimeout(() => {
      console.log("  Aborting request...");
      controller.abort();
    }, 1000);

    try {
      await normalClient.ocr.waitUntilDone(job.jobId, {
        pollInterval: 500,
        maxWait: 10000,
        signal: controller.signal,
      });
      console.log("[INFO] Job completed before abort signal");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("[PASS] Request correctly cancelled via AbortSignal");
      } else {
        console.log(`[INFO] Job processing result: ${error}`);
      }
    }
  } catch (error) {
    console.log(`[INFO] Could not create job for abort test: ${error}`);
  }

  console.log();
}

// Run the examples
main().catch(console.error);
