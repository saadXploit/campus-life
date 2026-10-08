import { webhookSignatureValid } from "@/lib/payments/paystack";
import { settlePurchase } from "@/lib/payments/settle";

/**
 * Paystack calls this when a payment succeeds, even if the player closed the page.
 * Only signed messages are accepted, and the payment is checked again with Paystack
 * before anything is handed over.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 100_000) return new Response("too large", { status: 413 });
  if (!webhookSignatureValid(raw, request.headers.get("x-paystack-signature"))) {
    return new Response("bad signature", { status: 401 });
  }

  let event: { event?: string; data?: { reference?: unknown } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("bad body", { status: 400 });
  }

  const reference = typeof event.data?.reference === "string" ? event.data.reference : "";
  if (event.event === "charge.success" && /^CL-[a-f0-9]{32}$/.test(reference)) {
    const result = await settlePurchase(reference);
    // Ask Paystack to try again later if we could not confirm it right now.
    if (result.status === "unknown") return new Response("retry", { status: 500 });
  }
  return new Response("ok", { status: 200 });
}
