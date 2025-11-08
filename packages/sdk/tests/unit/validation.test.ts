import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateBuffer, validateFile } from "../../src/utils/validation.js";

const TEST_DIR = join(process.cwd(), "tests", "fixtures", "temp");

describe("File Validation", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("validateFile", () => {
    it("should validate valid PDF file", () => {
      const filePath = join(TEST_DIR, "test.pdf");
      writeFileSync(filePath, Buffer.from("PDF content"));

      const result = validateFile(filePath);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should validate valid PNG file", () => {
      const filePath = join(TEST_DIR, "test.png");
      writeFileSync(filePath, Buffer.from("PNG content"));

      const result = validateFile(filePath);
      expect(result.valid).toBe(true);
    });

    it("should validate valid JPEG file", () => {
      const filePath = join(TEST_DIR, "test.jpg");
      writeFileSync(filePath, Buffer.from("JPG content"));

      const result = validateFile(filePath);
      expect(result.valid).toBe(true);
    });

    it("should validate valid TIFF file", () => {
      const filePath = join(TEST_DIR, "test.tiff");
      writeFileSync(filePath, Buffer.from("TIFF content"));

      const result = validateFile(filePath);
      expect(result.valid).toBe(true);
    });

    it("should validate valid WEBP file", () => {
      const filePath = join(TEST_DIR, "test.webp");
      writeFileSync(filePath, Buffer.from("WEBP content"));

      const result = validateFile(filePath);
      expect(result.valid).toBe(true);
    });

    it("should reject non-existent file", () => {
      const result = validateFile(join(TEST_DIR, "nonexistent.pdf"));
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File not found");
    });

    it("should reject directory", () => {
      const dirPath = join(TEST_DIR, "testdir");
      mkdirSync(dirPath);

      const result = validateFile(dirPath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not a file");
    });

    it("should reject unsupported file type", () => {
      const filePath = join(TEST_DIR, "test.txt");
      writeFileSync(filePath, "text content");

      const result = validateFile(filePath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not supported");
      expect(result.error).toContain(".txt");
    });

    it("should reject file exceeding max size", () => {
      const filePath = join(TEST_DIR, "large.pdf");
      const largeBuffer = Buffer.alloc(1024); // 1KB

      writeFileSync(filePath, largeBuffer);

      const result = validateFile(filePath, { maxSize: 512 }); // 512 bytes max
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum");
    });

    it("should accept file within size limit", () => {
      const filePath = join(TEST_DIR, "small.pdf");
      writeFileSync(filePath, Buffer.from("small"));

      const result = validateFile(filePath, { maxSize: 1024 });
      expect(result.valid).toBe(true);
    });

    it("should respect custom allowed types", () => {
      const filePath = join(TEST_DIR, "test.pdf");
      writeFileSync(filePath, "content");

      const result = validateFile(filePath, { allowedTypes: [".png", ".jpg"] });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not supported");
    });

    it("should handle case-insensitive extensions", () => {
      const filePath = join(TEST_DIR, "test.PDF");
      writeFileSync(filePath, "content");

      const result = validateFile(filePath);
      expect(result.valid).toBe(true);
    });
  });

  describe("validateBuffer", () => {
    it("should validate buffer with PDF filename", () => {
      const buffer = Buffer.from("PDF content");
      const result = validateBuffer(buffer, "test.pdf");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should validate buffer with PNG filename", () => {
      const buffer = Buffer.from("PNG content");
      const result = validateBuffer(buffer, "test.png");

      expect(result.valid).toBe(true);
    });

    it("should validate buffer with JPEG filename", () => {
      const buffer = Buffer.from("JPEG content");
      const result = validateBuffer(buffer, "test.jpeg");

      expect(result.valid).toBe(true);
    });

    it("should reject buffer with unsupported extension", () => {
      const buffer = Buffer.from("text content");
      const result = validateBuffer(buffer, "test.txt");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("not supported");
      expect(result.error).toContain(".txt");
    });

    it("should reject buffer exceeding max size", () => {
      const buffer = Buffer.alloc(1024); // 1KB
      const result = validateBuffer(buffer, "test.pdf", { maxSize: 512 });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum");
    });

    it("should accept buffer within size limit", () => {
      const buffer = Buffer.from("small content");
      const result = validateBuffer(buffer, "test.pdf", { maxSize: 1024 });

      expect(result.valid).toBe(true);
    });

    it("should respect custom allowed types", () => {
      const buffer = Buffer.from("content");
      const result = validateBuffer(buffer, "test.pdf", {
        allowedTypes: [".png"],
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("not supported");
    });

    it("should handle empty buffer", () => {
      const buffer = Buffer.alloc(0);
      const result = validateBuffer(buffer, "test.pdf");

      expect(result.valid).toBe(true);
    });

    it("should handle case-insensitive extensions", () => {
      const buffer = Buffer.from("content");
      const result = validateBuffer(buffer, "test.PDF");

      expect(result.valid).toBe(true);
    });

    it("should format file sizes correctly in error messages", () => {
      const buffer = Buffer.alloc(2 * 1024 * 1024); // 2MB
      const result = validateBuffer(buffer, "test.pdf", {
        maxSize: 1024 * 1024,
      }); // 1MB max

      expect(result.valid).toBe(false);
      expect(result.error).toContain("2.0 MB");
      expect(result.error).toContain("1.0 MB");
    });
  });
});
