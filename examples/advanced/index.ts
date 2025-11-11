import { LeapOCR } from "leapocr";

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

  // Example: Template slug with batch processing
  try {
    await templateBatchProcessingExample(apiKey);
  } catch (error) {
    console.error("Template batch processing example failed:", error);
  }

  // Example: Job lifecycle management
  try {
    await jobLifecycleExample(apiKey);
  } catch (error) {
    console.error("Job lifecycle example failed:", error);
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
    const job = await client.ocr.processURL(
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      {
        format: "structured",
        model: "pro-v1",
        instructions: "Extract all data with high accuracy",
      }
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
      `Starting concurrent processing of ${fileURLs.length} files...`
    );

    const uploadPromises = fileURLs.map(async (url, index) => {
      try {
        console.log(`Starting processing for file ${index + 1}: ${url}`);

        const job = await client.ocr.processURL(url, {
          format: "structured",
          model: "standard-v1",
          instructions: `Process document ${index + 1}`,
        });

        console.log(`File ${index + 1} uploaded - Job ID: ${job.jobId}`);

        // Wait for completion
        const result = await client.ocr.waitUntilDone(job.jobId, {
          pollInterval: 2000,
          maxWait: 300000, // 5 minutes
          onProgress: (status) => {
            if (status.progress) {
              console.log(
                `File ${index + 1} - ${status.status}: ${status.progress.toFixed(1)}%`
              );
            }
          },
        });

        if (result.status === "completed") {
          const fullResult = await client.ocr.getJobResult(job.jobId);
          console.log(
            `Completed processing file ${index + 1} (Job ID: ${job.jobId})`
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
      `  Successfully processed: ${successCount}/${fileURLs.length} files`
    );
    console.log(`  Total credits used: ${totalCredits}`);

    results.forEach((result) => {
      if (result.success) {
        console.log(
          `  [SUCCESS] File ${result.index} - Credits: ${result.credits}, Pages: ${result.pages}`
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
    const job = await client.ocr.processURL(invoiceURL, {
      format: "structured",
      model: "pro-v1", // Use highest quality model for best accuracy
      schema: invoiceSchema,
      instructions:
        "Extract invoice data according to the provided schema. Be precise with numbers and dates.",
    });

    console.log(`Job created with ID: ${job.jobId}`);

    // Wait for completion
    const result = await client.ocr.waitUntilDone(job.jobId, {
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
          JSON.stringify(fullResult.pages[0], null, 2)
        );
      }
    } else {
      console.error(`Processing failed with status: ${result.status}`);
    }
  } catch (error) {
    console.log(`Expected failure with example URL: ${error}`);
    console.log(
      "In a real scenario, this would process the invoice and extract:"
    );
    console.log("- Invoice number");
    console.log("- Total amount");
    console.log("- Vendor name");
    console.log("- Due date");
    console.log("- Line items with quantities and prices");
  }

  console.log();
}

async function templateBatchProcessingExample(apiKey: string) {
  console.log("=== Template Batch Processing Example ===");

  const client = new LeapOCR({
    apiKey,
    baseURL: process.env.LEAPOCR_BASE_URL,
  });

  // Different document types with different templates
  const documents = [
    {
      url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      templateSlug: "invoice-template",
      type: "invoice",
    },
    {
      url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      templateSlug: "receipt-template",
      type: "receipt",
    },
    {
      url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      templateSlug: "contract-template",
      type: "contract",
    },
  ];

  try {
    console.log(
      `Processing ${documents.length} documents with different templates...`
    );

    // Process all documents in parallel using their respective templates
    const jobs = await Promise.all(
      documents.map(async (doc) => {
        try {
          const job = await client.ocr.processURL(doc.url, {
            templateSlug: doc.templateSlug,
            model: "pro-v1",
          });

          console.log(
            `${doc.type}: Job ${job.jobId} created with template "${doc.templateSlug}"`
          );

          return { ...job, type: doc.type, templateSlug: doc.templateSlug };
        } catch (error) {
          console.error(`Failed to create job for ${doc.type}:`, error);
          return null;
        }
      })
    );

    // Wait for all jobs to complete
    const results = await Promise.all(
      jobs
        .filter((job) => job !== null)
        .map(async (job) => {
          try {
            const result = await client.ocr.waitUntilDone(job.jobId, {
              pollInterval: 2000,
              maxWait: 300000,
              onProgress: (status) => {
                if (status.progress) {
                  console.log(
                    `${job.type} (${job.templateSlug}): ${status.progress.toFixed(1)}%`
                  );
                }
              },
            });

            return {
              type: job.type,
              templateSlug: job.templateSlug,
              status: result.status,
              jobId: job.jobId,
            };
          } catch (error) {
            console.error(`Failed to process ${job.type}:`, error);
            return {
              type: job.type,
              templateSlug: job.templateSlug,
              status: "failed",
              error: String(error),
            };
          }
        })
    );

    console.log("\nTemplate-based batch processing complete:");
    results.forEach((result) => {
      const status = result.status === "completed" ? "✓" : "✗";
      console.log(
        `  ${status} ${result.type} (${result.templateSlug}): ${result.status}`
      );
    });
  } catch (error) {
    console.log(`Template batch processing: ${error}`);
    console.log("Note: Templates must be created in your dashboard first");
  }

  console.log();
}

async function jobLifecycleExample(apiKey: string) {
  console.log("=== Job Lifecycle Management Example ===");

  const client = new LeapOCR({
    apiKey,
    baseURL: process.env.LEAPOCR_BASE_URL,
  });

  const fileURL =
    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

  try {
    // 1. Create job
    console.log("1. Creating job...");
    const job = await client.ocr.processURL(fileURL, {
      format: "structured",
      model: "standard-v1",
      instructions: "Extract all text content",
    });
    console.log(`   Job created: ${job.jobId}`);

    // 2. Monitor status
    console.log("2. Monitoring job status...");
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const status = await client.ocr.getJobStatus(job.jobId);
      console.log(
        `   Status check ${attempts + 1}: ${status.status} (${status.progress?.toFixed(1) || 0}%)`
      );

      if (status.status === "completed" || status.status === "failed") {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    }

    // 3. Retrieve results
    console.log("3. Retrieving results...");
    const result = await client.ocr.getJobResult(job.jobId);
    console.log(`   Status: ${result.status}`);
    console.log(`   Credits used: ${result.credits_used || 0}`);
    console.log(`   Pages processed: ${result.pages?.length || 0}`);

    // 4. Clean up - delete job
    console.log("4. Cleaning up job...");
    await client.ocr.deleteJob(job.jobId);
    console.log("   Job deleted successfully");

    // 5. Verify deletion
    console.log("5. Verifying deletion...");
    try {
      await client.ocr.getJobStatus(job.jobId);
      console.log("   [FAIL] Job still exists");
    } catch {
      console.log("   [PASS] Job successfully deleted");
    }

    console.log("\nComplete job lifecycle demonstrated:");
    console.log("  ✓ Create job");
    console.log("  ✓ Monitor progress");
    console.log("  ✓ Retrieve results");
    console.log("  ✓ Delete job");
    console.log("  ✓ Verify cleanup");
  } catch (error) {
    console.log(`Job lifecycle example: ${error}`);
    console.log(
      "This example shows proper resource management with job deletion"
    );
  }

  console.log();
}

// Run the examples
main().catch(console.error);
