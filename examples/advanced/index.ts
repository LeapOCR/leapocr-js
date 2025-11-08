import { LeapOCR } from "@leapocr/sdk";

/**
 * Advanced usage examples for LeapOCR SDK
 *
 * Demonstrates:
 * - Custom configuration
 * - Concurrent batch processing
 * - Schema-based extraction
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

  // Example: Custom configuration
  try {
    await customConfigExample(apiKey);
  } catch (error) {
    console.error("Custom config example failed:", error);
  }

  // Example: Batch processing with concurrency
  try {
    await batchProcessingExample(apiKey);
  } catch (error) {
    console.error("Batch processing example failed:", error);
  }

  // Example: Schema-based extraction
  try {
    await schemaExtractionExample(apiKey);
  } catch (error) {
    console.error("Schema extraction example failed:", error);
  }
}

async function customConfigExample(apiKey: string) {
  console.log("=== Custom Configuration Example ===");

  // Create custom configuration
  const client = new LeapOCR({
    apiKey,
    baseURL: process.env.LEAPOCR_BASE_URL || "http://localhost:8080/api/v1",
    timeout: 60000, // 60 seconds
    maxRetries: 5,
    retryDelay: 2000,
    retryMultiplier: 2,
    debug: true,
  });

  try {
    // Example URL processing with custom options
    const job = await client.ocr.uploadFromURL(
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      {
        format: "structured",
        model: "pro-v1",
        instructions: "Extract all data with high accuracy",
      },
    );

    console.log(`Job created with custom config: ${job.jobId}`);
    console.log("Custom configuration applied successfully");
  } catch (error) {
    console.log(`Expected failure with example URL: ${error}`);
  }

  console.log();
}

async function batchProcessingExample(apiKey: string) {
  console.log("=== Concurrent Batch Processing Example ===");

  const client = new LeapOCR({
    apiKey,
    baseURL: process.env.LEAPOCR_BASE_URL,
  });

  // Example URLs to process (replace with real URLs)
  const fileURLs = [
    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  ];

  try {
    // Process files concurrently
    console.log(
      `Starting concurrent processing of ${fileURLs.length} files...`,
    );

    const uploadPromises = fileURLs.map(async (url, index) => {
      try {
        console.log(`Starting processing for file ${index + 1}: ${url}`);

        const job = await client.ocr.uploadFromURL(url, {
          format: "structured",
          model: "standard-v1",
          instructions: `Process document ${index + 1}`,
        });

        console.log(`File ${index + 1} uploaded - Job ID: ${job.jobId}`);

        // Wait for completion
        const result = await client.ocr.waitForCompletion(job.jobId, {
          pollInterval: 2000,
          maxWait: 300000, // 5 minutes
          onProgress: (status) => {
            if (status.progress) {
              console.log(
                `File ${index + 1} - ${status.status}: ${status.progress.toFixed(1)}%`,
              );
            }
          },
        });

        if (result.status === "completed") {
          const fullResult = await client.ocr.getJobResult(job.jobId);
          console.log(
            `Completed processing file ${index + 1} (Job ID: ${job.jobId})`,
          );

          return {
            index: index + 1,
            jobId: job.jobId,
            success: true,
            credits: fullResult.credits_used || 0,
            pages: fullResult.pages?.length || 0,
          };
        } else {
          throw new Error(`Processing failed with status: ${result.status}`);
        }
      } catch (error) {
        console.error(`Failed to process file ${index + 1}:`, error);
        return {
          index: index + 1,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    const results = await Promise.all(uploadPromises);

    // Collect statistics
    const successCount = results.filter((r) => r.success).length;
    const totalCredits = results
      .filter((r) => r.success)
      .reduce((sum, r) => sum + (r.credits || 0), 0);

    console.log("\nBatch processing complete:");
    console.log(
      `  Successfully processed: ${successCount}/${fileURLs.length} files`,
    );
    console.log(`  Total credits used: ${totalCredits}`);

    results.forEach((result) => {
      if (result.success) {
        console.log(
          `  [SUCCESS] File ${result.index} - Credits: ${result.credits}, Pages: ${result.pages}`,
        );
      } else {
        console.log(`  [FAILED] File ${result.index} - Error: ${result.error}`);
      }
    });
  } catch (error) {
    console.error("Batch processing error:", error);
  }

  console.log();
}

async function schemaExtractionExample(apiKey: string) {
  console.log("=== Schema-Based Extraction Example ===");

  const client = new LeapOCR({
    apiKey,
    baseURL: process.env.LEAPOCR_BASE_URL,
  });

  // Define custom schema for invoice extraction
  const invoiceSchema = {
    type: "object",
    properties: {
      invoice_number: {
        type: "string",
        description: "The invoice number",
      },
      total_amount: {
        type: "number",
        description: "The total amount of the invoice",
      },
      vendor_name: {
        type: "string",
        description: "The name of the vendor/supplier",
      },
      due_date: {
        type: "string",
        format: "date",
        description: "The due date for payment",
      },
      line_items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: "number" },
            unit_price: { type: "number" },
            total: { type: "number" },
          },
        },
      },
    },
    required: ["invoice_number", "total_amount", "vendor_name"],
  };

  // Example URL (replace with a real invoice URL)
  const invoiceURL =
    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

  console.log(`Processing invoice with custom schema: ${invoiceURL}`);

  try {
    const job = await client.ocr.uploadFromURL(invoiceURL, {
      format: "structured",
      model: "pro-v1", // Use highest quality model for best accuracy
      schema: invoiceSchema,
      instructions:
        "Extract invoice data according to the provided schema. Be precise with numbers and dates.",
    });

    console.log(`Job created with ID: ${job.jobId}`);

    // Wait for completion
    const result = await client.ocr.waitForCompletion(job.jobId, {
      pollInterval: 2000,
      maxWait: 300000,
    });

    if (result.status === "completed") {
      const fullResult = await client.ocr.getJobResult(job.jobId);

      console.log("Schema-based extraction completed!");
      console.log(`Credits used: ${fullResult.credits_used}`);

      if (fullResult.pages && fullResult.pages.length > 0) {
        console.log(
          "Extracted data:",
          JSON.stringify(fullResult.pages[0], null, 2),
        );
      }
    } else {
      console.error(`Processing failed with status: ${result.status}`);
    }
  } catch (error) {
    console.log(`Expected failure with example URL: ${error}`);
    console.log(
      "In a real scenario, this would process the invoice and extract:",
    );
    console.log("- Invoice number");
    console.log("- Total amount");
    console.log("- Vendor name");
    console.log("- Due date");
    console.log("- Line items with quantities and prices");
  }

  console.log();
}

// Run the examples
main().catch(console.error);
