#!/usr/bin/env node

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const OPENAPI_URL = process.env.OPENAPI_URL || 'http://localhost:8080/api/v1/docs/openapi.json';
const SDK_TAG = 'SDK';

/**
 * Fetch OpenAPI spec from API
 */
async function fetchSpec() {
  console.log(`Fetching OpenAPI spec from ${OPENAPI_URL}...`);

  const response = await fetch(OPENAPI_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI spec: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Filter endpoints tagged with SDK
 */
function filterSDKEndpoints(spec) {
  const filtered = {
    ...spec,
    paths: {},
  };

  let keptPaths = 0;
  let keptOperations = 0;

  // Keep only paths with SDK tag
  Object.entries(spec.paths).forEach(([path, methods]) => {
    const filteredMethods = {};

    Object.entries(methods).forEach(([method, details]) => {
      if (details.tags?.includes(SDK_TAG)) {
        filteredMethods[method] = details;
        keptOperations++;
      }
    });

    if (Object.keys(filteredMethods).length > 0) {
      filtered.paths[path] = filteredMethods;
      keptPaths++;
    }
  });

  console.log(`✓ Kept ${keptPaths} paths with ${keptOperations} operations`);
  console.log('Filtered endpoints:');
  Object.entries(filtered.paths).forEach(([path, methods]) => {
    Object.keys(methods).forEach(method => {
      console.log(`  ${method.toUpperCase().padEnd(6)} ${path}`);
    });
  });

  return filtered;
}

/**
 * Clean up unused components
 */
function cleanUnusedComponents(spec) {
  // For now, keep all components as they might be referenced
  // In the future, we could implement reference tracking
  return spec;
}

/**
 * Main function
 */
async function main() {
  try {
    // Fetch spec
    const spec = await fetchSpec();
    console.log(`✓ Fetched OpenAPI spec v${spec.info.version}`);

    // Filter endpoints
    const filtered = filterSDKEndpoints(spec);

    // Clean up
    const cleaned = cleanUnusedComponents(filtered);

    // Write output
    const outputPath = join(__dirname, '..', 'openapi-filtered.json');
    writeFileSync(outputPath, JSON.stringify(cleaned, null, 2));

    console.log(`✓ Filtered spec written to ${outputPath}`);
    console.log('\nReady to generate SDK types with: pnpm run generate');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
