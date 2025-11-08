import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pollUntil } from "../../src/utils/polling.js";

describe("Polling Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("pollUntil", () => {
    it("should return immediately when condition is met", async () => {
      const operation = vi.fn().mockResolvedValue("complete");
      const condition = vi.fn().mockReturnValue(true);

      const promise = pollUntil(operation, condition);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe("complete");
      expect(operation).toHaveBeenCalledTimes(1);
      expect(condition).toHaveBeenCalledWith("complete");
    });

    it("should poll until condition is true", async () => {
      const values = ["pending", "processing", "complete"];
      let callCount = 0;

      const operation = vi.fn().mockImplementation(() => {
        return Promise.resolve(values[callCount++]);
      });

      const condition = vi
        .fn()
        .mockImplementation((value) => value === "complete");

      const promise = pollUntil(operation, condition, {
        pollInterval: 100,
        maxWait: 10000,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe("complete");
      expect(operation).toHaveBeenCalledTimes(3);
      expect(condition).toHaveBeenCalledTimes(3);
    });

    it("should call onProgress callback", async () => {
      const values = ["pending", "processing", "complete"];
      let callCount = 0;

      const operation = vi.fn().mockImplementation(() => {
        return Promise.resolve(values[callCount++]);
      });

      const condition = vi
        .fn()
        .mockImplementation((value) => value === "complete");

      const onProgress = vi.fn();

      const promise = pollUntil(operation, condition, {
        pollInterval: 100,
        maxWait: 10000,
        onProgress,
      });

      await vi.runAllTimersAsync();
      await promise;

      expect(onProgress).toHaveBeenCalledTimes(3);
      expect(onProgress).toHaveBeenCalledWith("pending");
      expect(onProgress).toHaveBeenCalledWith("processing");
      expect(onProgress).toHaveBeenCalledWith("complete");
    });

    it("should throw timeout error when maxWait exceeded", async () => {
      const operation = vi.fn().mockResolvedValue("pending");
      const condition = vi.fn().mockReturnValue(false);

      const promise = pollUntil(operation, condition, {
        pollInterval: 100,
        maxWait: 500,
      });

      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow("Polling timeout after 500ms");
    });

    it("should respect poll interval", async () => {
      const values = ["pending", "complete"];
      let callCount = 0;

      const operation = vi.fn().mockImplementation(() => {
        return Promise.resolve(values[callCount++]);
      });

      const condition = vi
        .fn()
        .mockImplementation((value) => value === "complete");

      const promise = pollUntil(operation, condition, {
        pollInterval: 1000,
        maxWait: 10000,
      });

      // Advance time by 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result).toBe("complete");
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("should throw when signal is aborted", async () => {
      const abortController = new AbortController();
      const operation = vi.fn().mockResolvedValue("pending");
      const condition = vi.fn().mockReturnValue(false);

      const promise = pollUntil(operation, condition, {
        pollInterval: 100,
        maxWait: 10000,
        signal: abortController.signal,
      });

      // Abort after first call
      setTimeout(() => abortController.abort(), 50);

      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow("Polling cancelled");
    });

    it("should use default options when not specified", async () => {
      const operation = vi.fn().mockResolvedValue("complete");
      const condition = vi.fn().mockReturnValue(true);

      const promise = pollUntil(operation, condition);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe("complete");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should handle operation errors", async () => {
      const error = new Error("Operation failed");
      const operation = vi.fn().mockRejectedValue(error);
      const condition = vi.fn();

      const promise = pollUntil(operation, condition, {
        pollInterval: 100,
        maxWait: 1000,
      });

      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow("Operation failed");
    });

    it("should not exceed maxWait with delay", async () => {
      const operation = vi.fn().mockResolvedValue("pending");
      const condition = vi.fn().mockReturnValue(false);

      const promise = pollUntil(operation, condition, {
        pollInterval: 1000,
        maxWait: 2500,
      });

      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow("Polling timeout after 2500ms");

      // Should have polled at least twice
      expect(operation.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("should adjust delay when approaching maxWait", async () => {
      const operation = vi.fn().mockResolvedValue("pending");
      const condition = vi.fn().mockReturnValue(false);

      const promise = pollUntil(operation, condition, {
        pollInterval: 1000,
        maxWait: 1500,
      });

      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow("Polling timeout after 1500ms");

      // Should have polled at least once
      expect(operation.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle condition returning false then true", async () => {
      const operation = vi.fn().mockResolvedValue(42);
      let conditionCallCount = 0;

      const condition = vi.fn().mockImplementation(() => {
        conditionCallCount++;
        return conditionCallCount === 3;
      });

      const promise = pollUntil(operation, condition, {
        pollInterval: 100,
        maxWait: 10000,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe(42);
      expect(operation).toHaveBeenCalledTimes(3);
      expect(condition).toHaveBeenCalledTimes(3);
    });

    it("should handle complex condition logic", async () => {
      interface JobStatus {
        status: string;
        progress: number;
      }

      const statuses: JobStatus[] = [
        { status: "pending", progress: 0 },
        { status: "processing", progress: 50 },
        { status: "processing", progress: 75 },
        { status: "completed", progress: 100 },
      ];

      let callCount = 0;
      const operation = vi.fn().mockImplementation(() => {
        return Promise.resolve(statuses[callCount++]);
      });

      const condition = vi
        .fn()
        .mockImplementation(
          (value: JobStatus) =>
            value.status === "completed" && value.progress === 100,
        );

      const onProgress = vi.fn();

      const promise = pollUntil(operation, condition, {
        pollInterval: 100,
        maxWait: 10000,
        onProgress,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual({ status: "completed", progress: 100 });
      expect(operation).toHaveBeenCalledTimes(4);
      expect(onProgress).toHaveBeenCalledTimes(4);
    });

    it("should handle signal abort at specific time", async () => {
      const abortController = new AbortController();
      const operation = vi.fn().mockResolvedValue("pending");
      const condition = vi.fn().mockReturnValue(false);

      const promise = pollUntil(operation, condition, {
        pollInterval: 100,
        maxWait: 10000,
        signal: abortController.signal,
      });

      // Let it poll twice, then abort
      await vi.advanceTimersByTimeAsync(150);
      abortController.abort();

      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow("Polling cancelled");

      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});
