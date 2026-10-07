"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/guards";
import { can } from "@/lib/auth/roles";
import { getXIdentity } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  player: z.string().trim().min(3).max(20),
  direction: z.enum(["credit", "debit"]),
  amount: z.coerce.number().int().min(1).max(10_000_000),
  reason: z.string().trim().min(5).max(200),
});

function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function adjustWalletAction(formData: FormData): Promise<void> {
  const { user, role } = await requireStaff("SUPER_ADMIN");
  if (!can(role, "economy.inject")) redirect("/admin/economy?error=not_allowed");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/economy?error=invalid");
  const v = parsed.data;

  const admin = createAdminClient();
  // Exact name match (names are unique regardless of capital letters).
  const { data: player } = await admin
    .from("players")
    .select("id")
    .ilike("display_name", escapeLike(v.player))
    .maybeSingle();
  if (!player) redirect("/admin/economy?error=no_player");

  const kobo = v.amount * 100 * (v.direction === "credit" ? 1 : -1);
  // Moves the money, writes the ledger, the audit log and the player's notification in one step.
  const { error } = await admin.rpc("admin_adjust_wallet", {
    p_actor: user.id,
    p_actor_handle: getXIdentity(user)?.handle ?? null,
    p_player: player.id,
    p_amount_kobo: kobo,
    p_reason: v.reason,
  });
  if (error) {
    if (error.message.includes("not enough money")) redirect("/admin/economy?error=overdraw");
    console.error("admin_adjust_wallet failed:", error.message);
    redirect("/admin/economy?error=failed");
  }

  revalidatePath("/admin/economy");
  redirect("/admin/economy?done=1");
}
