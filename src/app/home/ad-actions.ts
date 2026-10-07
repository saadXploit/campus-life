"use server";

import { z } from "zod";
import { requirePlayerId } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

const uuid = z.string().uuid();

/** Counts that the player saw an ad (at most once per ad per day, decided by the database). */
export async function adViewAction(adId: string): Promise<void> {
  const userId = await requirePlayerId();
  const id = uuid.safeParse(adId);
  if (!id.success) return;
  const admin = createAdminClient();
  const { error } = await admin.rpc("record_ad_event", { p_user_id: userId, p_ad: id.data, p_kind: "view" });
  if (error && !error.message.includes("slow down")) console.error("record_ad_event failed:", error.message);
}

/** Counts the click and returns where the ad goes (only for live ads with a link). */
export async function adClickAction(adId: string): Promise<string | null> {
  const userId = await requirePlayerId();
  const id = uuid.safeParse(adId);
  if (!id.success) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_ad_event", { p_user_id: userId, p_ad: id.data, p_kind: "click" });
  if (error) {
    console.error("record_ad_event failed:", error.message);
    return null;
  }
  const url = typeof data === "string" ? data : null;
  // The database only allows https links; check again before handing one to the browser.
  return url && url.startsWith("https://") ? url : null;
}
