import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  classifyRefundResponse,
  verifyPayMongoWebhookSignature,
} from "../lib/paymongoRefund.ts";
import { getRefundStatusLabel } from "../lib/refundStatus.ts";

const paymentId = "pay_test_payment";
const refundId = "ref_test_refund";
const amount = 12500;

const providerPayload = (status: string) => ({
  data: {
    id: refundId,
    attributes: {
      payment_id: paymentId,
      amount,
      currency: "PHP",
      status,
    },
  },
});

test("accepts only a matching confirmed provider refund response", () => {
  const result = classifyRefundResponse(
    200,
    providerPayload("succeeded"),
    paymentId,
    amount
  );
  assert.equal(result.status, "succeeded");
  assert.equal(result.refundId, refundId);
  assert.equal(result.matchesPayment, true);
});

test("keeps provider pending status pending", () => {
  const result = classifyRefundResponse(
    201,
    providerPayload("pending"),
    paymentId,
    amount
  );
  assert.equal(result.status, "pending");
});

test("marks malformed, mismatched, and server-error responses ambiguous", () => {
  assert.equal(
    classifyRefundResponse(200, { data: { id: refundId, attributes: {} } }, paymentId, amount)
      .status,
    "ambiguous"
  );
  assert.equal(
    classifyRefundResponse(
      200,
      providerPayload("succeeded"),
      paymentId,
      amount + 1
    ).status,
    "ambiguous"
  );
  assert.equal(
    classifyRefundResponse(
      503,
      providerPayload("succeeded"),
      paymentId,
      amount
    ).status,
    "ambiguous"
  );
});

test("marks definitive provider client rejection failed without retrying", () => {
  const result = classifyRefundResponse(
    422,
    { errors: [{ detail: "Payment is not refundable." }] },
    paymentId,
    amount
  );
  assert.equal(result.status, "failed");
  assert.equal(result.failureReason, "Payment is not refundable.");
});

test("uses consistent labels for refund workflow states", () => {
  assert.equal(getRefundStatusLabel("requested"), "Pending review");
  assert.equal(getRefundStatusLabel("approved"), "Approved - not processed");
  assert.equal(getRefundStatusLabel("processing"), "Processing");
  assert.equal(getRefundStatusLabel("pending"), "Awaiting PayMongo");
  assert.equal(getRefundStatusLabel("ambiguous"), "Needs reconciliation");
  assert.equal(getRefundStatusLabel("succeeded"), "Completed");
});

test("verifies the PayMongo HMAC and rejects missing, malformed, and stale signatures", () => {
  const secret = "test-webhook-secret";
  const body = JSON.stringify({ data: { id: "evt_test" } });
  const now = 1_800_000_000_000;
  const timestamp = String(now / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  const header = `t=${timestamp},te=${signature},li=invalid`;

  assert.equal(verifyPayMongoWebhookSignature(body, header, secret, now), true);
  assert.equal(verifyPayMongoWebhookSignature(body, header, "", now), false);
  assert.equal(verifyPayMongoWebhookSignature(body, "t=1,te=bad", secret, now), false);
  assert.equal(
    verifyPayMongoWebhookSignature(body, header, secret, now + 6 * 60 * 1000),
    false
  );
});
