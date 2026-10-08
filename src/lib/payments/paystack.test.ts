import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const KEY = "sk_test_abc123";

async function load() {
  vi.resetModules();
  return import("./paystack");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("paystack webhook signature", () => {
  it("accepts a message signed with the secret key", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", KEY);
    const { webhookSignatureValid } = await load();
    const body = JSON.stringify({ event: "charge.success", data: { reference: "CL-" + "a".repeat(32) } });
    const sig = createHmac("sha512", KEY).update(body).digest("hex");
    expect(webhookSignatureValid(body, sig)).toBe(true);
  });

  it("rejects a changed body, a wrong key or no signature", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", KEY);
    const { webhookSignatureValid } = await load();
    const body = '{"event":"charge.success"}';
    const sig = createHmac("sha512", KEY).update(body).digest("hex");
    expect(webhookSignatureValid(body + " ", sig)).toBe(false);
    expect(webhookSignatureValid(body, createHmac("sha512", "sk_test_other").update(body).digest("hex"))).toBe(false);
    expect(webhookSignatureValid(body, null)).toBe(false);
    expect(webhookSignatureValid(body, "zz")).toBe(false);
  });

  it("rejects everything while payments are not set up", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "");
    const { webhookSignatureValid, paystackKey } = await load();
    expect(paystackKey()).toBeNull();
    expect(webhookSignatureValid("{}", createHmac("sha512", "").update("{}").digest("hex"))).toBe(false);
  });

  it("knows test mode from the key", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", KEY);
    const { paystackTestMode } = await load();
    expect(paystackTestMode()).toBe(true);
  });
});
