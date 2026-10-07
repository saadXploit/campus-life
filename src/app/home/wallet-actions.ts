"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { allowRequest } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PlayerResult = { id: string; name: string; university: string | null };
export type LedgerLine = {
  id: number;
  amount_kobo: number;
  balance_after_kobo: number;
  kind: string;
  description: string;
  created_at: string;
};
export type GameNotification = {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export async function searchPlayersAction(query: string): Promise<PlayerResult[]> {
  const user = await requireUser();
  const parsed = z.string().trim().min(2).max(20).safeParse(query);
  if (!parsed.success) return [];
  if (!(await allowRequest("player-search", 60, 60, { userId: user.id }))) return [];

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("search_players", {
    p_user_id: user.id,
    p_query: parsed.data,
  });
  if (error) {
    console.error("search_players failed:", error.message);
    return [];
  }
  return ((data ?? []) as { player_id: string; display_name: string; university: string | null }[]).map(
    (r) => ({ id: r.player_id, name: r.display_name, university: r.university })
  );
}

const sendSchema = z.object({
  toPlayerId: z.string().uuid(),
  amountKobo: z.number().int().min(100).max(100_000_000_000),
  note: z.string().trim().max(80),
  key: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
});

const SEND_ERRORS: Record<string, string> = {
  "not enough money": "You do not have enough money for that.",
  "amount too small": "The smallest transfer is ₦1.",
  "whole naira only": "Please send whole naira amounts.",
  "amount too large": "That is more than you can send at once.",
  "daily amount limit": "You have reached today's sending limit.",
  "daily transfer limit": "You have made too many transfers today.",
  "account too new": "New students can send money after their first day on campus.",
  "cannot send to yourself": "You cannot send money to yourself.",
  "unknown recipient": "That student could not be found.",
  "recipient unavailable": "That student cannot receive money right now.",
};

export async function sendMoneyAction(input: {
  toPlayerId: string;
  amountKobo: number;
  note: string;
  key: string;
}): Promise<{ ok: true; balanceKobo: number | null } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the transfer details." };

  if (!(await allowRequest("transfer", 10, 60, { userId: user.id }))) {
    return { ok: false, error: "Too many transfers. Wait a minute and try again." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("transfer_cash", {
    p_user_id: user.id,
    p_to_player: parsed.data.toPlayerId,
    p_amount_kobo: parsed.data.amountKobo,
    p_note: parsed.data.note,
    p_key: parsed.data.key,
  });

  if (error) {
    // Two identical requests at the same moment: the first one went through.
    if (error.message.includes("idempotency_key")) return { ok: true, balanceKobo: null };
    const known = Object.keys(SEND_ERRORS).find((k) => error.message.includes(k));
    if (known) return { ok: false, error: SEND_ERRORS[known] };
    console.error("transfer_cash failed:", error.message);
    return { ok: false, error: "The transfer could not be completed. No money was moved." };
  }

  const result = data as { balance_kobo?: number };
  return { ok: true, balanceKobo: result.balance_kobo ?? null };
}

/** The player's latest 25 ledger lines. The database only returns their own. */
export async function walletHistoryAction(): Promise<LedgerLine[]> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("id, amount_kobo, balance_after_kobo, kind, description, created_at")
    .order("id", { ascending: false })
    .limit(25);
  return (data ?? []) as LedgerLine[];
}

/** Latest 30 notifications, then marks them all read. */
export async function openNotificationsAction(): Promise<GameNotification[]> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, read_at, created_at")
    .order("id", { ascending: false })
    .limit(30);

  const admin = createAdminClient();
  const { error } = await admin.rpc("mark_notifications_read", { p_user_id: user.id });
  if (error) console.error("mark_notifications_read failed:", error.message);

  return (data ?? []) as GameNotification[];
}
