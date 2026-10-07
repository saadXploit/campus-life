import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PlayerState = {
  energy: number;
  health: number;
  happiness: number;
  day_number: number;
  hours_left: number;
  slept_today: boolean;
  locations: { name: string; kind: string } | null;
};

/** Starts a new campus day for this player if one has begun since they last played. */
export async function ensureToday(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("ensure_today", { p_user_id: userId });
  if (error) {
    console.error("ensure_today failed:", error.message);
    return false;
  }
  return true;
}

export async function getMyState(): Promise<PlayerState | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("player_state")
    .select("energy, health, happiness, day_number, hours_left, slept_today, locations(name, kind)")
    .maybeSingle();
  if (!data) return null;

  const state = data as unknown as PlayerState;
  return { ...state, hours_left: Number(state.hours_left) };
}