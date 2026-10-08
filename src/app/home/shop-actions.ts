"use server";

import { z } from "zod";
import { requirePlayerId } from "@/lib/auth/guards";
import { getServerEnv } from "@/lib/env";
import { initializePayment, paystackKey, paystackTestMode } from "@/lib/payments/paystack";
import type { ShopData } from "@/lib/game/shop";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// The shop. Real money only buys items; it never adds game naira. The database checks
// age, ownership and the rate limit; Paystack takes the payment on its own page.

const ERRORS: Record<string, string> = {
  "shop: closed": "The shop is closed right now.",
  "shop: unknown item": "That item is not on sale.",
  "shop: adults only": "Shop purchases are for players aged 18 and over.",
  "shop: confirm age": "Please confirm you are 18 or older.",
  "shop: owned": "You already own that.",
  "shop: not owned": "You don't own that yet.",
  "slow down": "Slow down a little and try again.",
  blocked: "This account cannot play right now.",
};

function message(raw: string): string {
  const known = Object.keys(ERRORS).find((k) => raw.includes(k));
  return known ? ERRORS[known] : "Something went wrong. Please try again.";
}

export async function shopAction(): Promise<(ShopData & { payments: boolean; test_mode: boolean }) | null> {
  const userId = await requirePlayerId();
  const { data, error } = await createAdminClient().rpc("get_shop", { p_user_id: userId });
  if (error) {
    console.error("get_shop failed:", error.message);
    return null;
  }
  return { ...(data as ShopData), payments: paystackKey() !== null, test_mode: paystackTestMode() };
}

const buySchema = z.object({
  item: z.string().regex(/^[a-z0-9_]{2,40}$/),
  confirmAdult: z.boolean(),
  email: z.string().trim().email().max(200).optional(),
});

/** Opens an order and returns the Paystack page to send the player to. */
export async function buyAction(
  item: string,
  confirmAdult: boolean,
  email?: string
): Promise<{ url?: string; error?: string; needEmail?: boolean }> {
  const userId = await requirePlayerId();
  const parsed = buySchema.safeParse({ item, confirmAdult, email: email || undefined });
  if (!parsed.success) return { error: "Please enter a valid email address." };
  if (!paystackKey()) return { error: "Payments are not set up yet." };

  // Paystack sends the receipt to this email. X accounts may not share one.
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const accountEmail = typeof claims?.claims?.email === "string" ? claims.claims.email : "";
  const payEmail = parsed.data.email ?? accountEmail;
  if (!z.string().email().safeParse(payEmail).success) return { needEmail: true };

  const { data, error } = await createAdminClient().rpc("create_purchase", {
    p_user_id: userId,
    p_item: parsed.data.item,
    p_confirm_adult: parsed.data.confirmAdult,
  });
  if (error) return { error: message(error.message) };
  const order = data as { purchase_id: string; reference: string; amount_kobo: number };

  const site = getServerEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const result = await initializePayment({
    email: payEmail,
    amountKobo: order.amount_kobo,
    reference: order.reference,
    callbackUrl: `${site}/shop/return`,
    metadata: { purchase_id: order.purchase_id, item: parsed.data.item },
  });
  return "url" in result ? { url: result.url } : { error: result.error };
}

export async function equipAction(item: string, on: boolean): Promise<{ style?: Record<string, string>; error?: string }> {
  const userId = await requirePlayerId();
  if (!/^[a-z0-9_]{2,40}$/.test(item)) return { error: "That item does not exist." };
  const { data, error } = await createAdminClient().rpc("equip_item", { p_user_id: userId, p_item: item, p_on: on === true });
  if (error) return { error: message(error.message) };
  return { style: (data as { style: Record<string, string> }).style };
}
