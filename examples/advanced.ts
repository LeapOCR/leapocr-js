/**
 * Advanced example: Manual job control with retries and error handling
 */

import {
  LeapOCR,
  AuthenticationError,
  RateLimitError,
  FileError,
  JobFailedError,
  TimeoutError,
} from '@leapocr/sdk';

async function main() {
  const client = new LeapOCR(process.env.LEAPOCR_API_KEY || '');

  try {
    console.log('=== Advanced OCR Processing ===\n');

    // Step 1: Upload file
    console.log('1. Uploading file...');
    const upload = await client.ocr.uploadFile('./sample.pdf', {
      model: 'apex-v1',
      metadata: {
        source: 'advanced-example',
        timestamp: new Date().toISOString(),
      },
    });
    console.log(`✓ Upload initiated, Job ID: ${upload.jobId}`);

    // Step 2: Poll status manually
    console.log('\n2. Polling job status...');
    let status = await client.ocr.getJobStatus(upload.jobId);
    let attempts = 0;
    const maxAttempts = 30;

    while (
      status.status !== 'completed' &&
      status.status !== 'failed' &&
      attempts < maxAttempts
    ) {
      console.log(
        `   Attempt ${attempts + 1}: ${status.status} (${status.progress || 0}%)`
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
      status = await client.ocr.getJobStatus(upload.jobId);
      attempts++;
    }

    if (status.status === 'failed') {
      throw new JobFailedError(upload.jobId, status.error);
    }

    if (attempts >= maxAttempts) {
      throw new TimeoutError(upload.jobId, maxAttempts * 2000);
    }

    console.log(`✓ Job completed in ${attempts * 2}s`);

    // Step 3: Fetch results with pagination
    console.log('\n3. Fetching results...');
    const results = await client.ocr.getResults(upload.jobId, {
      page: 1,
      limit: 10,
    });

    console.log(`✓ Retrieved ${results.pages?.length || 0} pages`);

    // Process results
    if (results.pages && results.pages.length > 0) {
      console.log('\n=== Results Summary ===');
      results.pages.forEach((page: any, idx: number) => {
        const wordCount = page.text?.split(/\s+/).length || 0;
        console.log(`Page ${idx + 1}: ${wordCount} words`);
      });
    }
  } catch (error) {
    // Detailed error handling
    if (error instanceof AuthenticationError) {
      console.error('❌ Authentication failed - check your API key');
    } else if (error instanceof RateLimitError) {
      console.error(
        `❌ Rate limited - retry after ${error.retryAfter}s`
      );
    } else if (error instanceof FileError) {
      console.error(
        `❌ File error: ${error.message}`
      );
      console.error(`   File: ${error.filePath}`);
    } else if (error instanceof JobFailedError) {
      console.error(`❌ Job failed: ${error.message}`);
      console.error(`   Error: ${JSON.stringify(error.jobError)}`);
    } else if (error instanceof TimeoutError) {
      console.error(`❌ Job timed out after ${error.timeoutMs}ms`);
    } else {
      console.error('❌ Unexpected error:', error);
    }
  } finally {
    await client.close();
  }
}

main();
