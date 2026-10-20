import { createHmac, timingSafeEqual } from "node:crypto";

export type RefundProviderStatus =
  | "succeeded"
  | "pending"
  | "processing"
  | "failed"
  | "ambiguous";

export interface RefundProviderResult {
  status: RefundProviderStatus;
  refundId: string | null;
  failureReason: string | null;
  metadata: Record<string, unknown>;
  matchesPayment: boolean;
}

export function classifyRefundResponse(
  httpStatus: number,
  payload: any,
  expectedPaymentId: string,
  expectedAmount: number
): RefundProviderResult {
  const data = payload?.data;
  const attributes = data?.attributes || {};
  const refundId =
    typeof data?.id === "string" && data.id.startsWith("ref_") ? data.id : null;
  const matchesPayment =
    refundId !== null &&
    attributes.payment_id === expectedPaymentId &&
    Number(attributes.amount) === expectedAmount &&
    String(attributes.currency || "").toUpperCase() === "PHP";
  const providerStatus = String(attributes.status || "").toLowerCase();
  const metadata =
    attributes && typeof attributes === "object" && !Array.isArray(attributes)
      ? attributes
      : {};

  if (
    httpStatus >= 400 &&
    httpStatus < 500 &&
    httpStatus !== 408 &&
    httpStatus !== 409 &&
    httpStatus !== 429 &&
    !refundId
  ) {
    const providerError = payload?.errors?.[0]?.detail || payload?.errors?.[0]?.code;
    return {
      status: "failed",
      refundId: null,
      failureReason:
        typeof providerError === "string"
          ? providerError
          : `PayMongo rejected the refund request (${httpStatus}).`,
      metadata,
      matchesPayment: false,
    };
  }

  if (
    httpStatus < 200 ||
    httpStatus >= 300 ||
    !matchesPayment ||
    !["succeeded", "pending", "processing", "failed"].includes(providerStatus)
  ) {
    return {
      status: "ambiguous",
      refundId,
      failureReason: matchesPayment
        ? `PayMongo returned an unconfirmed response (${httpStatus}).`
        : "PayMongo response did not match the original payment and refund amount.",
      metadata,
      matchesPayment,
    };
  }

  return {
    status: providerStatus as RefundProviderStatus,
    refundId,
    failureReason: null,
    metadata,
    matchesPayment: true,
  };
}

export function verifyPayMongoWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowMs = Date.now()
): boolean {
  if (!secret || !signatureHeader) return false;

  const fields = new Map<string, string>();
  for (const part of signatureHeader.split(",")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    fields.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }

  const timestamp = fields.get("t");
  if (!timestamp || !/^\d+$/.test(timestamp)) return false;
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isSafeInteger(timestampMs) || Math.abs(nowMs - timestampMs) > 5 * 60 * 1000) {
    return false;
  }

  const message = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(message).digest();
  const signatures = [fields.get("te"), fields.get("li")].filter(
    (signature): signature is string => Boolean(signature && /^[a-f0-9]{64}$/i.test(signature))
  );

  return signatures.some((signature) => {
    const supplied = Buffer.from(signature, "hex");
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
}
