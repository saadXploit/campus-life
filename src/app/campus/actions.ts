"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { ensureToday } from "@/lib/game/state";
import { createAdminClient } from "@/lib/supabase/admin";

export async function travelAction(locationId: string): Promise<{ error?: string }> {
  const user = await requireUser();

  const parsed = z.string().uuid().safeParse(locationId);
  if (!parsed.success) return { error: "That place does not exist." };

  if (!(await ensureToday(user.id))) {
    return { error: "Could not start your day. Please try again." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("travel_to", {
    p_user_id: user.id,
    p_location_id: parsed.data,
  });

  if (error) {
    if (error.message.includes("not enough time")) {
      return { error: "You do not have enough hours left today." };
    }
    if (error.message.includes("too tired")) {
      return { error: "You are too tired to walk that far. Rest first." };
    }
    if (error.message.includes("already there")) {
      return { error: "You are already here." };
    }
    console.error("travel_to failed:", error.message);
    return { error: "Could not make that trip. Please try again." };
  }

  return {};
}