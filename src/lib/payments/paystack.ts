import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Paystack: the only place that talks to the payment company.
 * The secret key never leaves the server. Real money here only ever buys shop items;
 * it never adds game naira.
 */

const API = "https://api.paystack.co";

/** The secret key, or null while payments are not set up (the shop then says so). */
export function paystackKey(): string | null {
  const key = process.env.PAYSTACK_SECRET_KEY;
  return key && /^sk_(test|live)_[A-Za-z0-9]+$/.test(key) ? key : null;
}

/** True while using Paystack test keys (no real money moves). */
export function paystackTestMode(): boolean {
  return paystackKey()?.startsWith("sk_test_") ?? false;
}

type InitResult = { url: string } | { error: string };

/** Starts a payment and returns the Paystack page to send the player to. */
export async function initializePayment(input: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}): Promise<InitResult> {
  const key = paystackKey();
  if (!key) return { error: "Payments are not set up yet." };
  try {
    const res = await fetch(`${API}/transaction/initialize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        amount: input.amountKobo,
        currency: "NGN",
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json()) as { status?: boolean; message?: string; data?: { authorization_url?: string } };
    const url = body.data?.authorization_url;
    if (!res.ok || !body.status || !url || !url.startsWith("https://")) {
      console.error("paystack initialize failed:", res.status, body.message);
      return { error: "Could not start the payment. Please try again." };
    }
    return { url };
  } catch (e) {
    console.error("paystack initialize error:", e);
    return { error: "Could not reach the payment service. Please try again." };
  }
}

export type VerifiedPayment = {
  status: string;
  amountKobo: number;
  currency: string;
  reference: string;
  id: string;
};

/** Asks Paystack directly what happened to a payment (never trust the browser). */
export async function verifyPayment(reference: string): Promise<VerifiedPayment | null> {
  const key = paystackKey();
  if (!key || !/^CL-[a-f0-9]{32}$/.test(reference)) return null;
  try {
    const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json()) as {
      status?: boolean;
      data?: { status?: string; amount?: number; currency?: string; reference?: string; id?: number | string };
    };
    const d = body.data;
    if (!res.ok || !body.status || !d || d.reference !== reference) return null;
    return {
      status: String(d.status ?? ""),
      amountKobo: Number(d.amount ?? 0),
      currency: String(d.currency ?? ""),
      reference,
      id: String(d.id ?? ""),
    };
  } catch (e) {
    console.error("paystack verify error:", e);
    return null;
  }
}

/** Checks that a webhook really came from Paystack (HMAC SHA-512 of the raw body). */
export function webhookSignatureValid(rawBody: string, signature: string | null): boolean {
  const key = paystackKey();
  if (!key || !signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", key).update(rawBody).digest();
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
