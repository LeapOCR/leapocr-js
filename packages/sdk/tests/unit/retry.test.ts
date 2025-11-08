import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RETRY_OPTIONS,
  getRetryDelay,
  isRetriableError,
  withRetry,
} from "../../src/utils/retry.js";

describe("Retry Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isRetriableError", () => {
    it("should return false for non-AxiosError", () => {
      const error = new Error("Regular error");
      expect(isRetriableError(error)).toBe(false);
    });

    it("should return true for network errors (no response)", () => {
      const error = new AxiosError("Network Error");
      error.response = undefined;
      expect(isRetriableError(error)).toBe(true);
    });

    it("should return true for ECONNABORTED", () => {
      const error = new AxiosError("Connection aborted");
      error.code = "ECONNABORTED";
      expect(isRetriableError(error)).toBe(true);
    });

    it("should return true for ETIMEDOUT", () => {
      const error = new AxiosError("Timeout");
      error.code = "ETIMEDOUT";
      expect(isRetriableError(error)).toBe(true);
    });

    it("should return true for 500 Internal Server Error", () => {
      const error = new AxiosError("Server Error");
      error.response = { status: 500 } as any;
      expect(isRetriableError(error)).toBe(true);
    });

    it("should return true for 502 Bad Gateway", () => {
      const error = new AxiosError("Bad Gateway");
      error.response = { status: 502 } as any;
      expect(isRetriableError(error)).toBe(true);
    });

    it("should return true for 503 Service Unavailable", () => {
      const error = new AxiosError("Service Unavailable");
      error.response = { status: 503 } as any;
      expect(isRetriableError(error)).toBe(true);
    });

    it("should return true for 504 Gateway Timeout", () => {
      const error = new AxiosError("Gateway Timeout");
      error.response = { status: 504 } as any;
      expect(isRetriableError(error)).toBe(true);
    });

    it("should return true for 429 Rate Limit", () => {
      const error = new AxiosError("Rate Limit");
      error.response = { status: 429 } as any;
      expect(isRetriableError(error)).toBe(true);
    });

    it("should return true for 408 Request Timeout", () => {
      const error = new AxiosError("Request Timeout");
      error.response = { status: 408 } as any;
      expect(isRetriableError(error)).toBe(true);
    });

    it("should return false for 401 Unauthorized", () => {
      const error = new AxiosError("Unauthorized");
      error.response = { status: 401 } as any;
      expect(isRetriableError(error)).toBe(false);
    });

    it("should return false for 403 Forbidden", () => {
      const error = new AxiosError("Forbidden");
      error.response = { status: 403 } as any;
      expect(isRetriableError(error)).toBe(false);
    });

    it("should return false for 400 Bad Request", () => {
      const error = new AxiosError("Bad Request");
      error.response = { status: 400 } as any;
      expect(isRetriableError(error)).toBe(false);
    });

    it("should return false for 404 Not Found", () => {
      const error = new AxiosError("Not Found");
      error.response = { status: 404 } as any;
      expect(isRetriableError(error)).toBe(false);
    });

    it("should return false for 422 Unprocessable Entity", () => {
      const error = new AxiosError("Validation Error");
      error.response = { status: 422 } as any;
      expect(isRetriableError(error)).toBe(false);
    });
  });

  describe("getRetryDelay", () => {
    it("should respect Retry-After header (seconds)", () => {
      const error = new AxiosError("Rate Limited");
      error.response = {
        status: 429,
        headers: { "retry-after": "5" },
      } as any;

      const delay = getRetryDelay(0, DEFAULT_RETRY_OPTIONS, error);
      expect(delay).toBe(5000); // 5 seconds in ms
    });

    it("should use exponential backoff when no Retry-After", () => {
      const error = new AxiosError("Server Error");
      error.response = { status: 500 } as any;

      const delay0 = getRetryDelay(0, DEFAULT_RETRY_OPTIONS, error);
      const delay1 = getRetryDelay(1, DEFAULT_RETRY_OPTIONS, error);

      // First attempt: ~1000ms (±25% jitter)
      expect(delay0).toBeGreaterThan(700);
      expect(delay0).toBeLessThan(1300);

      // Second attempt: ~2000ms (±25% jitter)
      expect(delay1).toBeGreaterThan(1400);
      expect(delay1).toBeLessThan(2600);
    });

    it("should cap delay at maxDelay", () => {
      const error = new AxiosError("Server Error");
      error.response = { status: 500 } as any;

      const options = {
        ...DEFAULT_RETRY_OPTIONS,
        maxDelay: 5000,
      };

      // Attempt 10 would normally give 1000 * 2^10 = 1,024,000ms
      const delay = getRetryDelay(10, options, error);
      expect(delay).toBeLessThan(6300); // Max + jitter margin
    });

    it("should apply jitter to delay", () => {
      const error = new AxiosError("Server Error");
      error.response = { status: 500 } as any;

      const delays = new Set();
      for (let i = 0; i < 30; i++) {
        const delay = getRetryDelay(0, DEFAULT_RETRY_OPTIONS, error);
        delays.add(delay);
      }

      // With jitter, we should get different values
      expect(delays.size).toBeGreaterThan(3);
    });

    it("should handle invalid Retry-After header", () => {
      const error = new AxiosError("Rate Limited");
      error.response = {
        status: 429,
        headers: { "retry-after": "invalid" },
      } as any;

      const delay = getRetryDelay(0, DEFAULT_RETRY_OPTIONS, error);
      // Should fall back to exponential backoff
      expect(delay).toBeGreaterThanOrEqual(750);
      expect(delay).toBeLessThanOrEqual(1250);
    });
  });

  describe("withRetry", () => {
    it("should return immediately on success", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await withRetry(operation);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry on retriable error and succeed", async () => {
      const error = new AxiosError("Server Error");
      error.response = { status: 500 } as any;

      const operation = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const result = await withRetry(operation, {
        maxRetries: 2,
        initialDelay: 10,
      });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("should not retry on non-retriable error", async () => {
      const error = new AxiosError("Unauthorized");
      error.response = { status: 401 } as any;

      const operation = vi.fn().mockRejectedValue(error);

      await expect(
        withRetry(operation, { maxRetries: 3, initialDelay: 10 }),
      ).rejects.toThrow("Unauthorized");

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should throw after max retries exceeded", async () => {
      const error = new AxiosError("Server Error");
      error.response = { status: 500 } as any;

      const operation = vi.fn().mockRejectedValue(error);

      await expect(
        withRetry(operation, { maxRetries: 2, initialDelay: 1 }),
      ).rejects.toThrow("Server Error");

      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("should call onRetry callback", async () => {
      const error = new AxiosError("Server Error");
      error.response = { status: 500 } as any;

      const operation = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const onRetry = vi.fn();

      await withRetry(operation, {
        maxRetries: 2,
        initialDelay: 1,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, error);
    });

    it("should wait between retries", async () => {
      const error = new AxiosError("Server Error");
      error.response = { status: 500 } as any;

      const operation = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const startTime = Date.now();
      await withRetry(operation, {
        maxRetries: 2,
        initialDelay: 20,
        multiplier: 1,
      });
      const endTime = Date.now();

      // Should have waited at least a few ms
      expect(endTime - startTime).toBeGreaterThanOrEqual(10);
    });

    it("should use custom retry options", async () => {
      const error = new AxiosError("Server Error");
      error.response = { status: 500 } as any;

      const operation = vi.fn().mockRejectedValue(error);

      await expect(
        withRetry(operation, {
          maxRetries: 5,
          initialDelay: 1,
          maxDelay: 1000,
          multiplier: 3,
        }),
      ).rejects.toThrow();

      expect(operation).toHaveBeenCalledTimes(6); // Initial + 5 retries
    });

    it("should handle network errors", async () => {
      const error = new AxiosError("Network Error");
      error.response = undefined; // Network error has no response

      const operation = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const result = await withRetry(operation, {
        maxRetries: 2,
        initialDelay: 1,
      });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("should handle rate limit with Retry-After", async () => {
      const error = new AxiosError("Rate Limited");
      error.response = {
        status: 429,
        headers: { "retry-after": "1" },
      } as any;

      const operation = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const startTime = Date.now();
      await withRetry(operation, { maxRetries: 2, initialDelay: 1 });
      const endTime = Date.now();

      expect(operation).toHaveBeenCalledTimes(2);
      // Should have waited at least 1 second
      expect(endTime - startTime).toBeGreaterThan(900);
    });
  });
});
