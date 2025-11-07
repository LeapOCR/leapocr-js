/**
 * URL upload example: Process a document from a URL
 */

import { LeapOCR } from '@leapocr/sdk';

async function main() {
  const client = new LeapOCR(process.env.LEAPOCR_API_KEY || '');

  try {
    console.log('=== URL Upload Example ===\n');

    const documentURL = 'https://example.com/sample-document.pdf';
    console.log(`Processing document from: ${documentURL}\n`);

    // Upload and process from URL
    const result = await client.ocr.processFile(
      documentURL,
      {
        model: 'standard-v1',
      },
      {
        onProgress: (status) => {
          console.log(
            `Progress: ${status.status} (${status.progress || 0}%)`
          );
        },
      }
    );

    console.log('\n✓ Processing complete!');
    console.log(`Total pages: ${result.pages?.length || 0}`);

    // Extract and display text from each page
    if (result.pages) {
      console.log('\n=== Extracted Text ===\n');
      result.pages.forEach((page: any, idx: number) => {
        console.log(`--- Page ${idx + 1} ---`);
        console.log(page.text?.substring(0, 300) + '...\n');
      });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

main();
