import Link from "next/link";
import { requirePlayerId } from "@/lib/auth/guards";
import { settlePurchase } from "@/lib/payments/settle";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Paystack sends the player back here. We never trust the address bar: the payment is
 * checked with Paystack on the server before the item is handed over.
 */
export default async function ShopReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const userId = await requirePlayerId();
  const { reference, trxref } = await searchParams;
  const ref = reference ?? trxref ?? "";

  let title = "We couldn't find that payment";
  let body = "If money left your account, it will be confirmed shortly. Check the shop again in a few minutes.";
  let ok = false;

  if (/^CL-[a-f0-9]{32}$/.test(ref)) {
    const result = await settlePurchase(ref);
    const { data: me } = await createAdminClient().from("players").select("id").eq("user_id", userId).maybeSingle();
    const mine = result.status === "paid" || result.status === "failed" ? result.playerId === me?.id : true;
    if (!mine) {
      title = "This payment belongs to another account";
      body = "Sign in with the account that made the purchase.";
    } else if (result.status === "paid") {
      const { data: item } = await createAdminClient().from("shop_items").select("name").eq("slug", result.item).maybeSingle();
      ok = true;
      title = `${item?.name ?? "Your item"} is yours!`;
      body = "Thank you. It is ready in the game now.";
    } else if (result.status === "failed") {
      title = "The payment did not go through";
      body = "You have not been charged for this item. You can try again from the shop.";
    } else if (result.status === "pending") {
      title = "Waiting for your bank";
      body = "Your payment is still being processed. Your item will appear as soon as it is confirmed.";
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070a14] p-6 text-white">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-5xl">{ok ? "🛍️" : "⏳"}</p>
        <h1 className="mt-3 text-2xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm text-zinc-300">{body}</p>
        <Link href="/home" className="mt-6 block rounded-2xl bg-amber-400 py-3 font-extrabold text-black">
          Back to campus
        </Link>
        <Link href="/refunds" className="mt-3 block text-xs text-zinc-500 underline">
          Refund policy
        </Link>
      </div>
    </main>
  );
}
