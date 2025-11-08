import { describe, it, expect, beforeAll } from "vitest";
import { LeapOCR } from "../../src/client.js";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { Readable } from "stream";

/**
 * Integration tests for OCR service
 * These tests require a running LeapOCR API server
 * Set LEAPOCR_API_KEY and LEAPOCR_BASE_URL environment variables
 */

const TEST_DIR = join(process.cwd(), "tests", "fixtures", "integration");
const SAMPLE_DIR = join(process.cwd(), "../..", "sample"); // Assuming monorepo structure
const API_KEY = process.env.LEAPOCR_API_KEY || "";
const BASE_URL = process.env.LEAPOCR_BASE_URL || "http://localhost:8080/api/v1";

// Skip integration tests if API key is not set
const runIntegrationTests = API_KEY.length > 0;

// Helper to find test PDF file
function findTestPDF(): string | null {
  const testFiles = [
    join(SAMPLE_DIR, "test.pdf"),
    join(SAMPLE_DIR, "A129of19_14.01.22.pdf"),
    join(SAMPLE_DIR, "A141of21_10.02.22.pdf"),
  ];

  for (const file of testFiles) {
    try {
      require("fs").accessSync(file);
      return file;
    } catch {
      // File doesn't exist, try next
    }
  }
  return null;
}

describe.skipIf(!runIntegrationTests)("OCR Integration Tests", () => {
  let client: LeapOCR;
  let testPDFPath: string | null;

  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });

    // Try to find real test PDF
    testPDFPath = findTestPDF();

    if (!testPDFPath) {
      // Fallback: Create minimal test PDF
      testPDFPath = join(TEST_DIR, "sample.pdf");
      const pdfContent = Buffer.from(
        "%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 4 0 R\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 5 0 R\n>>\nendobj\n4 0 obj\n<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\nendobj\n5 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000262 00000 n\n0000000341 00000 n\ntrailer\n<<\n/Size 6\n/Root 1 0 R\n>>\nstartxref\n435\n%%EOF",
      );
      writeFileSync(testPDFPath, pdfContent);
    }

    client = new LeapOCR({
      apiKey: API_KEY,
      baseURL: BASE_URL,
    });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("File Upload", () => {
    it("should upload PDF file successfully", async () => {
      if (!testPDFPath) {
        throw new Error("No test PDF available");
      }

      const result = await client.ocr.uploadFile(testPDFPath, {
        format: "markdown",
        model: "standard-v1",
      });

      expect(result.jobId).toBeDefined();
      expect(result.status).toBe("pending");
      expect(result.createdAt).toBeInstanceOf(Date);
    }, 30000);

    it("should upload with structured format", async () => {
      if (!testPDFPath) {
        throw new Error("No test PDF available");
      }

      const result = await client.ocr.uploadFile(testPDFPath, {
        format: "structured",
        model: "standard-v1",
        instructions: "Extract all text and identify key information",
      });

      expect(result.jobId).toBeDefined();
      expect(result.status).toBe("pending");
    }, 30000);

    it("should upload with pro model", async () => {
      if (!testPDFPath) {
        throw new Error("No test PDF available");
      }

      const result = await client.ocr.uploadFile(testPDFPath, {
        format: "markdown",
        model: "pro-v1",
      });

      expect(result.jobId).toBeDefined();
    }, 30000);

    it("should upload with english-pro model", async () => {
      if (!testPDFPath) {
        throw new Error("No test PDF available");
      }

      const result = await client.ocr.uploadFile(testPDFPath, {
        format: "markdown",
        model: "english-pro-v1",
      });

      expect(result.jobId).toBeDefined();
    }, 30000);
  });

  describe("Buffer Upload", () => {
    it("should upload buffer successfully", async () => {
      if (!testPDFPath) {
        throw new Error("No test PDF available");
      }

      const buffer = require("fs").readFileSync(testPDFPath);

      const result = await client.ocr.uploadFileBuffer(buffer, "test.pdf", {
        format: "markdown",
        model: "standard-v1",
      });

      expect(result.jobId).toBeDefined();
      expect(result.status).toBe("pending");
    }, 30000);
  });

  describe("Stream Upload", () => {
    it("should upload stream successfully", async () => {
      if (!testPDFPath) {
        throw new Error("No test PDF available");
      }

      const stream = require("fs").createReadStream(testPDFPath);

      const result = await client.ocr.uploadFileStream(stream, "test.pdf", {
        format: "markdown",
        model: "standard-v1",
      });

      expect(result.jobId).toBeDefined();
      expect(result.status).toBe("pending");
    }, 30000);
  });

  describe("URL Upload", () => {
    it("should upload from public URL", async () => {
      // Using a public sample PDF
      const url =
        "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

      const result = await client.ocr.uploadFromURL(url, {
        format: "markdown",
        model: "standard-v1",
      });

      expect(result.jobId).toBeDefined();
      expect(result.status).toBe("pending");
    }, 30000);
  });

  describe("Job Status", () => {
    it("should get job status", async () => {
      if (!testPDFPath) throw new Error("No test PDF");

      const uploadResult = await client.ocr.uploadFile(testPDFPath, {
        format: "markdown",
        model: "standard-v1",
      });

      const status = await client.ocr.getJobStatus(uploadResult.jobId);

      expect(status.jobId).toBe(uploadResult.jobId);
      expect(status.status).toMatch(/pending|processing|completed|failed/);
      expect(status.createdAt).toBeInstanceOf(Date);
    }, 30000);
  });

  describe("Wait for Completion", () => {
    it("should wait for job completion", async () => {
      if (!testPDFPath) throw new Error("No test PDF");

      const uploadResult = await client.ocr.uploadFile(testPDFPath, {
        format: "markdown",
        model: "standard-v1",
      });

      const result = await client.ocr.waitForCompletion(uploadResult.jobId, {
        pollInterval: 2000,
        maxWait: 60000,
      });

      expect(result.status).toMatch(/completed|failed/);
      expect(result.updatedAt).toBeInstanceOf(Date);
    }, 70000);

    it("should track progress during polling", async () => {
      if (!testPDFPath) throw new Error("No test PDF");

      const uploadResult = await client.ocr.uploadFile(testPDFPath, {
        format: "markdown",
        model: "standard-v1",
      });

      const progressUpdates: string[] = [];

      await client.ocr.waitForCompletion(uploadResult.jobId, {
        pollInterval: 2000,
        maxWait: 60000,
        onProgress: (status) => {
          progressUpdates.push(status.status);
        },
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
    }, 70000);
  });

  describe("Get Results", () => {
    it("should get job results after completion", async () => {
      if (!testPDFPath) throw new Error("No test PDF");

      const uploadResult = await client.ocr.uploadFile(testPDFPath, {
        format: "markdown",
        model: "standard-v1",
      });

      await client.ocr.waitForCompletion(uploadResult.jobId, {
        pollInterval: 2000,
        maxWait: 60000,
      });

      const result = await client.ocr.getJobResult(uploadResult.jobId);

      expect(result.status).toBe("completed");
      expect(result.pages).toBeDefined();
      if (result.pages && result.pages.length > 0) {
        expect(result.pages[0]).toHaveProperty("page_number");
        expect(result.pages[0]).toHaveProperty("text");
      }
    }, 70000);

    it("should support pagination", async () => {
      if (!testPDFPath) throw new Error("No test PDF");

      const uploadResult = await client.ocr.uploadFile(testPDFPath, {
        format: "markdown",
        model: "standard-v1",
      });

      await client.ocr.waitForCompletion(uploadResult.jobId, {
        pollInterval: 2000,
        maxWait: 60000,
      });

      const result = await client.ocr.getJobResult(uploadResult.jobId, {
        page: 1,
        pageSize: 10,
      });

      expect(result.status).toBe("completed");
    }, 70000);
  });

  describe("Process File (Upload + Wait)", () => {
    it("should process file end-to-end", async () => {
      if (!testPDFPath) throw new Error("No test PDF");

      const result = await client.ocr.processFile(
        testPDFPath,
        {
          format: "markdown",
          model: "standard-v1",
        },
        {
          pollInterval: 2000,
          maxWait: 60000,
        },
      );

      expect(result.status).toBe("completed");
      expect(result.pages).toBeDefined();
    }, 70000);

    it("should process file with progress tracking", async () => {
      if (!testPDFPath) throw new Error("No test PDF");

      const progressUpdates: string[] = [];

      const result = await client.ocr.processFile(
        testPDFPath,
        {
          format: "markdown",
          model: "standard-v1",
        },
        {
          pollInterval: 2000,
          maxWait: 60000,
          onProgress: (status) => {
            progressUpdates.push(status.status);
          },
        },
      );

      expect(result.status).toMatch(/completed|failed/);
      expect(progressUpdates.length).toBeGreaterThan(0);
    }, 70000);
  });

  describe("Error Handling", () => {
    it("should handle invalid file type", async () => {
      const txtPath = join(TEST_DIR, "test.txt");
      writeFileSync(txtPath, "Text content");

      await expect(client.ocr.uploadFile(txtPath)).rejects.toThrow(
        "not supported",
      );
    });

    it("should handle non-existent file", async () => {
      await expect(
        client.ocr.uploadFile(join(TEST_DIR, "nonexistent.pdf")),
      ).rejects.toThrow("File not found");
    });

    it("should handle invalid URL", async () => {
      await expect(client.ocr.uploadFromURL("not-a-url")).rejects.toThrow();
    });

    it("should timeout on long-running job", async () => {
      if (!testPDFPath) throw new Error("No test PDF");

      const uploadResult = await client.ocr.uploadFile(testPDFPath, {
        format: "markdown",
        model: "standard-v1",
      });

      await expect(
        client.ocr.waitForCompletion(uploadResult.jobId, {
          pollInterval: 100,
          maxWait: 500, // Very short timeout
        }),
      ).rejects.toThrow("timed out");
    }, 30000);
  });

  describe("Concurrent Operations", () => {
    it("should handle multiple concurrent uploads", async () => {
      if (!testPDFPath) throw new Error("No test PDF");

      const uploads = await Promise.all([
        client.ocr.uploadFile(testPDFPath, {
          format: "markdown",
          model: "standard-v1",
        }),
        client.ocr.uploadFile(testPDFPath, {
          format: "markdown",
          model: "standard-v1",
        }),
        client.ocr.uploadFile(testPDFPath, {
          format: "markdown",
          model: "standard-v1",
        }),
      ]);

      expect(uploads).toHaveLength(3);
      uploads.forEach((upload) => {
        expect(upload.jobId).toBeDefined();
      });

      // Verify all job IDs are unique
      const jobIds = uploads.map((u) => u.jobId);
      const uniqueJobIds = new Set(jobIds);
      expect(uniqueJobIds.size).toBe(3);
    }, 30000);
  });
});
