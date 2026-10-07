import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GameStateResult } from "./gameTypes";

/** Everything the game screen needs, in ONE database call. Null if the database could not be reached. */
export async function getGameState(userId: string): Promise<GameStateResult | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_game_state", { p_user_id: userId });
  if (error) {
    console.error("get_game_state failed:", error.message);
    return null;
  }
  return data as GameStateResult;
}
