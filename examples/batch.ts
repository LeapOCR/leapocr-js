/**
 * Batch processing example: Process multiple files
 */

import { LeapOCR } from '@leapocr/sdk';

async function main() {
  const client = new LeapOCR(process.env.LEAPOCR_API_KEY || '');

  try {
    console.log('=== Batch Processing ===\n');

    // List of files to process
    const files = [
      './documents/invoice1.pdf',
      './documents/invoice2.pdf',
      './documents/receipt.pdf',
    ];

    console.log(`Processing ${files.length} files in parallel...\n`);

    // Upload all files in batch with concurrency limit
    const batchResult = await client.ocr.processBatch(files, {
      model: 'standard-v1',
      concurrency: 3, // Process max 3 at a time
    });

    console.log(`✓ Uploaded ${batchResult.jobs.length}/${batchResult.totalFiles} files`);

    // Poll each job and collect results
    const results = await Promise.allSettled(
      batchResult.jobs.map(async (job) => {
        console.log(`Waiting for job ${job.jobId}...`);

        let status = await client.ocr.getJobStatus(job.jobId);
        let attempts = 0;

        while (
          status.status !== 'completed' &&
          status.status !== 'failed' &&
          attempts < 30
        ) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          status = await client.ocr.getJobStatus(job.jobId);
          attempts++;
        }

        if (status.status === 'completed') {
          const result = await client.ocr.getResults(job.jobId);
          return { jobId: job.jobId, result };
        } else {
          throw new Error(`Job ${job.jobId} failed`);
        }
      })
    );

    // Summary
    console.log('\n=== Results Summary ===');
    const successful = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    console.log(`✓ Successful: ${successful.length}`);
    console.log(`✗ Failed: ${failed.length}`);

    successful.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        const data = result.value.result;
        console.log(
          `\nJob ${idx + 1}: ${data.pages?.length || 0} pages processed`
        );
      }
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

main();
