const encoder = new TextEncoder();

export type WebhookPayload = string | ArrayBuffer | ArrayBufferView;

function toBytes(payload: WebhookPayload): Uint8Array {
  if (typeof payload === "string") {
    return encoder.encode(payload);
  }

  if (payload instanceof ArrayBuffer) {
    return new Uint8Array(payload);
  }

  return new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);

  let mismatch = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return mismatch === 0;
}

async function computeWebhookSignature(
  payload: WebhookPayload,
  secret: string,
): Promise<string> {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) {
    throw new Error("Web Crypto API is not available in this environment");
  }

  const key = await cryptoApi.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await cryptoApi.subtle.sign("HMAC", key, toBytes(payload));
  return toHex(new Uint8Array(signature));
}

/**
 * Verify a LeapOCR webhook signature against the raw request body.
 */
export async function verifyWebhookSignature(
  payload: WebhookPayload,
  signature: string,
  timestamp: string,
  secret: string,
): Promise<boolean> {
  if (!signature || !timestamp || !secret) {
    return false;
  }

  const signedPayload =
    typeof payload === "string"
      ? `${timestamp}.${payload}`
      : (() => {
          const bodyBytes = toBytes(payload);
          const prefix = encoder.encode(`${timestamp}.`);
          const combined = new Uint8Array(prefix.length + bodyBytes.length);
          combined.set(prefix);
          combined.set(bodyBytes, prefix.length);
          return combined;
        })();

  const expected = await computeWebhookSignature(signedPayload, secret);
  return constantTimeEqual(signature, expected);
}
