import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "../../src/utils/webhooks.js";

describe("Webhook Signature Verification", () => {
  const payload =
    '{"event_type":"webhook.test","event_id":"evt_123","timestamp":"2024-01-01T00:00:00Z","message":"This is a test webhook event"}';
  const secret = "my-secret-key";
  const timestamp = "1704067200";
  const signature =
    "51033b9251a1db2003caf73152dc990d20c3efd8c97d176603de1dc034aa1bc1";

  it("accepts a valid signature", async () => {
    await expect(
      verifyWebhookSignature(payload, signature, timestamp, secret),
    ).resolves.toBe(true);
  });

  it("accepts typed array payloads", async () => {
    await expect(
      verifyWebhookSignature(
        new TextEncoder().encode(payload),
        signature,
        timestamp,
        secret,
      ),
    ).resolves.toBe(true);
  });

  it("rejects an invalid signature", async () => {
    await expect(
      verifyWebhookSignature(payload, "invalid-signature", timestamp, secret),
    ).resolves.toBe(false);
  });

  it("rejects a different payload", async () => {
    await expect(
      verifyWebhookSignature(
        '{"event_type":"webhook.test","event_id":"evt_123","timestamp":"2024-01-01T00:00:00Z","message":"different payload"}',
        signature,
        timestamp,
        secret,
      ),
    ).resolves.toBe(false);
  });

  it("rejects a different timestamp", async () => {
    await expect(
      verifyWebhookSignature(payload, signature, "1704067201", secret),
    ).resolves.toBe(false);
  });

  it("rejects missing signature, timestamp, or secret", async () => {
    await expect(
      verifyWebhookSignature(payload, "", timestamp, secret),
    ).resolves.toBe(false);
    await expect(
      verifyWebhookSignature(payload, signature, "", secret),
    ).resolves.toBe(false);
    await expect(
      verifyWebhookSignature(payload, signature, timestamp, ""),
    ).resolves.toBe(false);
  });
});
