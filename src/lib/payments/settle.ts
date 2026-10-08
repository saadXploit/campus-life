import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPayment } from "./paystack";

export type SettleResult =
  | { status: "paid"; item: string; playerId: string }
  | { status: "failed"; item?: string; playerId?: string }
  | { status: "pending" }
  | { status: "unknown" };

/**
 * Finishes an order: asks Paystack what happened, then lets the database hand over
 * the item (which checks the amount and currency, and only ever does it once).
 * Called by both the return page and the webhook, so either one is enough.
 */
export async function settlePurchase(reference: string): Promise<SettleResult> {
  const payment = await verifyPayment(reference);
  if (!payment) return { status: "unknown" };
  const admin = createAdminClient();

  if (payment.status === "success") {
    const { data, error } = await admin.rpc("fulfil_purchase", {
      p_reference: reference,
      p_amount_kobo: payment.amountKobo,
      p_currency: payment.currency,
      p_provider_txn: payment.id,
    });
    if (error) {
      console.error("fulfil_purchase failed:", error.message);
      return { status: "unknown" };
    }
    const d = data as { status: string; item: string; player_id: string };
    return d.status === "paid"
      ? { status: "paid", item: d.item, playerId: d.player_id }
      : { status: "failed", item: d.item, playerId: d.player_id };
  }

  if (payment.status === "failed" || payment.status === "abandoned" || payment.status === "reversed") {
    await admin.rpc("fail_purchase", { p_reference: reference, p_reason: `paystack: ${payment.status}` });
    return { status: "failed" };
  }
  return { status: "pending" };
}
