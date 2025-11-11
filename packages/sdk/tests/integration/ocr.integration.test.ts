import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LeapOCR } from "../../src/client.js";

/**
 * Integration tests for OCR service
 * These tests require a running LeapOCR API server
 * Set LEAPOCR_API_KEY and LEAPOCR_BASE_URL environment variables
 */

const TEST_DIR = join(process.cwd(), "tests", "fixtures", "integration");
const API_KEY = process.env.LEAPOCR_API_KEY || "";
const BASE_URL = process.env.LEAPOCR_BASE_URL || "http://localhost:8080/api/v1";

// Skip integration tests if API key is not set
const runIntegrationTests = API_KEY.length > 0;

describe.skipIf(!runIntegrationTests)("OCR Integration Tests", () => {
  let client: LeapOCR;
  let testPDFPath: string;

  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });

    // Reference the test PDF in packages/sdk/sample/test.pdf
    testPDFPath = join(process.cwd(), "sample", "test.pdf");

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
      const result = await client.ocr.processFile(testPDFPath, {
        format: "markdown",
        model: "standard-v1",
      });

      expect(result.jobId).toBeDefined();
      expect(result.status).toBe("pending");
      expect(result.createdAt).toBeInstanceOf(Date);
    }, 30000);

    it("should upload with structured format", async () => {
      const result = await client.ocr.processFile(testPDFPath, {
        format: "structured",
        model: "standard-v1",
        instructions: "Extract all text and identify key information",
      });

      expect(result.jobId).toBeDefined();
      expect(result.status).toBe("pending");
    }, 30000);

    it("should upload with pro model", async () => {
      const result = await client.ocr.processFile(testPDFPath, {
        format: "markdown",
        model: "pro-v1",
      });

      expect(result.jobId).toBeDefined();
    }, 30000);

    it("should upload with english-pro model", async () => {
      const result = await client.ocr.processFile(testPDFPath, {
        format: "markdown",
        model: "english-pro-v1",
      });

      expect(result.jobId).toBeDefined();
    }, 30000);
  });

  describe("Buffer Upload", () => {
    it("should upload buffer successfully", async () => {
      const buffer = require("fs").readFileSync(testPDFPath);

      const result = await client.ocr.processFileBuffer(buffer, "test.pdf", {
        format: "markdown",
        model: "standard-v1",
      });

      expect(result.jobId).toBeDefined();
      expect(result.status).toBe("pending");
    }, 30000);
  });

  describe("Stream Upload", () => {
    it("should upload stream successfully", async () => {
      const stream = require("fs").createReadStream(testPDFPath);

      const result = await client.ocr.processFileStream(stream, "test.pdf", {
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

      const result = await client.ocr.processURL(url, {
        format: "markdown",
        model: "standard-v1",
      });

      expect(result.jobId).toBeDefined();
      expect(result.status).toBe("pending");
    }, 30000);
  });

  describe("Job Status", () => {
    it("should get job status", async () => {
      const uploadResult = await client.ocr.processFile(testPDFPath, {
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
      const uploadResult = await client.ocr.processFile(testPDFPath, {
        format: "markdown",
        model: "standard-v1",
      });

      const result = await client.ocr.waitUntilDone(uploadResult.jobId, {
        pollInterval: 2000,
        maxWait: 60000,
      });

      expect(result.status).toMatch(/completed|failed/);
      expect(result.updatedAt).toBeInstanceOf(Date);
    }, 70000);

    it("should track progress during polling", async () => {
      const uploadResult = await client.ocr.processFile(testPDFPath, {
        format: "markdown",
        model: "standard-v1",
      });

      const progressUpdates: string[] = [];

      await client.ocr.waitUntilDone(uploadResult.jobId, {
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
      const uploadResult = await client.ocr.processFile(testPDFPath, {
        format: "markdown",
        model: "standard-v1",
      });

      await client.ocr.waitUntilDone(uploadResult.jobId, {
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
      const uploadResult = await client.ocr.processFile(testPDFPath, {
        format: "markdown",
        model: "standard-v1",
      });

      await client.ocr.waitUntilDone(uploadResult.jobId, {
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

  describe("Error Handling", () => {
    it("should handle invalid file type", async () => {
      const txtPath = join(TEST_DIR, "test.txt");
      require("fs").writeFileSync(txtPath, "Text content");

      await expect(client.ocr.processFile(txtPath)).rejects.toThrow(
        "not supported",
      );
    });

    it("should handle non-existent file", async () => {
      await expect(
        client.ocr.processFile(join(TEST_DIR, "nonexistent.pdf")),
      ).rejects.toThrow("File not found");
    });

    it("should handle invalid URL", async () => {
      await expect(client.ocr.processURL("not-a-url")).rejects.toThrow();
    });

    it("should timeout on long-running job", async () => {
      const uploadResult = await client.ocr.processFile(testPDFPath, {
        format: "markdown",
        model: "standard-v1",
      });

      await expect(
        client.ocr.waitUntilDone(uploadResult.jobId, {
          pollInterval: 100,
          maxWait: 500, // Very short timeout
        }),
      ).rejects.toThrow("timed out");
    }, 30000);
  });

  describe("Concurrent Operations", () => {
    it("should handle multiple concurrent uploads", async () => {
      const uploads = await Promise.all([
        client.ocr.processFile(testPDFPath, {
          format: "markdown",
          model: "standard-v1",
        }),
        client.ocr.processFile(testPDFPath, {
          format: "markdown",
          model: "standard-v1",
        }),
        client.ocr.processFile(testPDFPath, {
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

  describe("Job Deletion", () => {
    it("should delete a job successfully", async () => {
      const uploadResult = await client.ocr.processFile(testPDFPath, {
        format: "markdown",
        model: "standard-v1",
      });

      expect(uploadResult.jobId).toBeDefined();

      // Wait for completion
      await client.ocr.waitUntilDone(uploadResult.jobId, {
        pollInterval: 2000,
        maxWait: 60000,
      });

      // Delete the job
      await expect(
        client.ocr.deleteJob(uploadResult.jobId),
      ).resolves.not.toThrow();

      // Verify job is deleted by attempting to get status
      await expect(
        client.ocr.getJobStatus(uploadResult.jobId),
      ).rejects.toThrow();
    }, 70000);

    it("should handle deleting non-existent job", async () => {
      await expect(
        client.ocr.deleteJob("non-existent-job-id"),
      ).rejects.toThrow();
    }, 30000);

    it("should delete job immediately after creation", async () => {
      const uploadResult = await client.ocr.processFile(testPDFPath, {
        format: "markdown",
        model: "standard-v1",
      });

      // Delete immediately without waiting for completion
      await expect(
        client.ocr.deleteJob(uploadResult.jobId),
      ).resolves.not.toThrow();

      // Verify deletion
      await expect(
        client.ocr.getJobStatus(uploadResult.jobId),
      ).rejects.toThrow();
    }, 30000);
  });

  describe("Template Slug", () => {
    it("should process with template slug", async () => {
      const result = await client.ocr.processFile(testPDFPath, {
        templateSlug: "test-template",
        model: "standard-v1",
      });

      expect(result.jobId).toBeDefined();
      expect(result.status).toBe("pending");
    }, 30000);

    it("should process URL with template slug", async () => {
      const url =
        "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

      const result = await client.ocr.processURL(url, {
        templateSlug: "invoice-template",
        model: "pro-v1",
      });

      expect(result.jobId).toBeDefined();
      expect(result.status).toBe("pending");
    }, 30000);
  });
});
