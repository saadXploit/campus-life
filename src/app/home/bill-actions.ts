"use server";

import { z } from "zod";
import { requirePlayerId } from "@/lib/auth/guards";
import type { Bills } from "@/lib/game/bills";
import type { GameDynamic } from "@/lib/game/gameTypes";
import { createAdminClient } from "@/lib/supabase/admin";

// Paying school fees and rent, and choosing a room type. One database call each.

const ERRORS: Record<string, string> = {
  "not enough money": "You don't have enough money to pay this yet. Work a few shifts first.",
  "bill: unknown": "That bill could not be found.",
  "room: unknown": "That room type is not available at your university.",
  "slow down": "Slow down a little and try again.",
  blocked: "This account cannot play right now.",
};

function message(raw: string): string {
  const known = Object.keys(ERRORS).find((k) => raw.includes(k));
  if (!known) console.error("bills failed:", raw);
  return known ? ERRORS[known] : "Something went wrong. Please try again.";
}

export async function payBillAction(billId: number): Promise<{ data?: Bills & GameDynamic; error?: string }> {
  const userId = await requirePlayerId();
  if (!z.number().int().positive().safeParse(billId).success) return { error: "That bill could not be found." };
  const { data, error } = await createAdminClient().rpc("pay_bill", { p_user_id: userId, p_bill: billId });
  if (error) return { error: message(error.message) };
  return { data: data as Bills & GameDynamic };
}

export async function chooseRoomAction(slug: string): Promise<{ data?: Bills; error?: string }> {
  const userId = await requirePlayerId();
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return { error: "That room type is not available." };
  const { data, error } = await createAdminClient().rpc("choose_accommodation", { p_user_id: userId, p_slug: slug });
  if (error) return { error: message(error.message) };
  return { data: data as Bills };
}
