import { LeapOCR } from "leapocr";
import { access } from "fs/promises";

/**
 * Basic usage examples for LeapOCR SDK
 *
 * Set LEAPOCR_API_KEY environment variable before running:
 * export LEAPOCR_API_KEY="your-api-key"
 *
 * Run with: pnpm start
 */

async function main() {
  // Get API key from environment variable
  const apiKey = process.env.LEAPOCR_API_KEY;
  if (!apiKey) {
    console.error("LEAPOCR_API_KEY environment variable is required");
    process.exit(1);
  }

  // Example: Process a local PDF file
  try {
    await processLocalFile(apiKey);
  } catch (error) {
    console.error("Failed to process local file:", error);
  }

  // Example: Process a file from URL
  try {
    await processFileFromURL(apiKey);
  } catch (error) {
    console.error("Failed to process URL:", error);
  }

  // Example: Process with template slug
  try {
    await processWithTemplate(apiKey);
  } catch (error) {
    console.error("Failed to process with template:", error);
  }

  // Example: Delete a job
  try {
    await deleteJobExample(apiKey);
  } catch (error) {
    console.error("Failed to delete job:", error);
  }
}

async function processLocalFile(apiKey: string) {
  console.log("=== Processing Local File ===");

  // Check if example file exists
  const filePath = "./sample-document.pdf";
  try {
    await access(filePath);
  } catch {
    console.log(
      `Sample file ${filePath} not found, skipping local file example`
    );
    return;
  }

  // Create OCR client
  const client = new LeapOCR({
    apiKey,
    baseURL: process.env.LEAPOCR_BASE_URL,
  });

  try {
    // Start processing with options
    console.log(`Starting OCR processing for ${filePath}...`);
    const job = await client.ocr.processFile(filePath, {
      format: "structured",
      model: "standard-v1",
      instructions:
        "Extract all invoice details including amounts, dates, and vendor information",
    });

    console.log(`Job created with ID: ${job.jobId}`);

    // Wait for completion
    console.log("Waiting for processing to complete...");
    const result = await client.ocr.waitUntilDone(job.jobId, {
      pollInterval: 2000,
      maxWait: 300000, // 5 minutes
    });

    if (result.status === "completed") {
      // Get full results
      const fullResult = await client.ocr.getJobResult(job.jobId);

      console.log("Processing completed successfully!");
      console.log(`Credits used: ${fullResult.credits_used}`);
      console.log(`Processing time: ${fullResult.processing_time_seconds}s`);
      console.log(`Pages processed: ${fullResult.pages?.length || 0}`);

      // Print first page text (truncated)
      if (fullResult.pages && fullResult.pages.length > 0) {
        let text = fullResult.pages[0].text || "";
        if (text.length > 200) {
          text = text.substring(0, 200) + "...";
        }
        console.log(`First page text: ${text}`);
      }
    } else {
      console.error(`Processing failed with status: ${result.status}`);
    }
  } catch (error) {
    console.error("Error during processing:", error);
  }

  console.log();
}

async function processFileFromURL(apiKey: string) {
  console.log("=== Processing File from URL ===");

  // Example URL (replace with a real URL)
  const fileURL =
    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

  // Create OCR client
  const client = new LeapOCR({
    apiKey,
    baseURL: process.env.LEAPOCR_BASE_URL,
  });

  try {
    console.log(`Starting OCR processing for URL: ${fileURL}...`);
    const job = await client.ocr.processURL(fileURL, {
      format: "markdown",
      model: "standard-v1",
      instructions: "Extract key financial information",
    });

    console.log(`Job created with ID: ${job.jobId}`);

    // Poll for status updates manually (alternative to waitForCompletion)
    const pollInterval = 2000; // 2 seconds
    const maxAttempts = 150; // 5 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await client.ocr.getJobStatus(job.jobId);

      let statusMessage = `Status: ${status.status}`;
      if (status.progress) {
        statusMessage += ` (${status.progress.toFixed(1)}% complete)`;
      }
      console.log(statusMessage);

      if (status.status === "completed") {
        const result = await client.ocr.getJobResult(job.jobId);

        console.log("Processing completed!");
        console.log(`Credits used: ${result.credits_used}`);

        // Calculate total text length
        const totalText =
          result.pages?.map((p: any) => p.text || "").join("") || "";
        console.log(`Text length: ${totalText.length} characters`);

        return;
      } else if (status.status === "failed") {
        const errorMsg = status.error?.message || "unknown error";
        throw new Error(`Processing failed: ${errorMsg}`);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      attempts++;
    }

    throw new Error("Polling timeout: processing took too long");
  } catch (error) {
    console.error("Error during URL processing:", error);
  }

  console.log();
}

async function processWithTemplate(apiKey: string) {
  console.log("=== Processing with Template Slug ===");

  const client = new LeapOCR({
    apiKey,
    baseURL: process.env.LEAPOCR_BASE_URL,
  });

  const fileURL =
    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

  try {
    console.log("Processing document with template slug...");
    const job = await client.ocr.processURL(fileURL, {
      templateSlug: "invoice-template", // Use predefined template
      model: "pro-v1",
    });

    console.log(`Job created with ID: ${job.jobId}`);
    console.log("Using template slug: invoice-template");

    const result = await client.ocr.waitUntilDone(job.jobId, {
      pollInterval: 2000,
      maxWait: 300000,
    });

    if (result.status === "completed") {
      const fullResult = await client.ocr.getJobResult(job.jobId);
      console.log("Template-based extraction completed!");
      console.log(`Credits used: ${fullResult.credits_used}`);
      console.log("Extracted data follows template schema");
    }
  } catch (error) {
    console.log(`Template processing: ${error}`);
    console.log(
      "Note: Templates must be created in your LeapOCR dashboard first"
    );
  }

  console.log();
}

async function deleteJobExample(apiKey: string) {
  console.log("=== Delete Job Example ===");

  const client = new LeapOCR({
    apiKey,
    baseURL: process.env.LEAPOCR_BASE_URL,
  });

  const fileURL =
    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

  try {
    // Create a job
    console.log("Creating a job to delete...");
    const job = await client.ocr.processURL(fileURL, {
      format: "markdown",
      model: "standard-v1",
    });

    console.log(`Job created with ID: ${job.jobId}`);

    // Wait for completion
    const result = await client.ocr.waitUntilDone(job.jobId, {
      pollInterval: 2000,
      maxWait: 300000,
    });

    console.log(`Job status: ${result.status}`);

    // Delete the job
    console.log("Deleting job...");
    await client.ocr.deleteJob(job.jobId);
    console.log("Job deleted successfully!");

    // Verify deletion
    try {
      await client.ocr.getJobStatus(job.jobId);
      console.log("[FAIL] Job should have been deleted");
    } catch (error) {
      console.log("[PASS] Job no longer exists after deletion");
    }
  } catch (error) {
    console.log(`Delete job example: ${error}`);
  }

  console.log();
}

// Run the examples
main().catch(console.error);
