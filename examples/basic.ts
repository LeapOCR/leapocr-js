/**
 * Basic example: Upload and process a document
 */

import { LeapOCR } from '@leapocr/sdk';

async function main() {
  // Initialize client
  const client = new LeapOCR(process.env.LEAPOCR_API_KEY || '', {
    debug: true, // Enable debug logging
  });

  try {
    console.log('Uploading and processing document...\n');

    // Process file and wait for completion
    const result = await client.ocr.processFile(
      './sample.pdf',
      {
        model: 'standard-v1',
      },
      {
        pollInterval: 2000, // Check every 2 seconds
        maxWait: 60000, // Timeout after 1 minute
        onProgress: (status) => {
          console.log(`Status: ${status.status}, Progress: ${status.progress}%`);
        },
      }
    );

    console.log('\n✓ Processing complete!');
    console.log('Job ID:', result.job_id);
    console.log('Total pages:', result.pages?.length || 0);

    // Print first page text
    if (result.pages && result.pages.length > 0) {
      console.log('\nFirst page text:');
      console.log(result.pages[0].text?.substring(0, 200) + '...');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

main();
