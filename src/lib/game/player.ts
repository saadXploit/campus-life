import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Player = {
  id: string;
  display_name: string;
  age: number;
  gender: string;
  avatar_skin: number;
  avatar_hair_style: number;
  avatar_hair_color: number;
  avatar_outfit: number;
  background_slug: string;
  interest: string;
};

/** The signed-in player's own character. The database only ever returns their own row. */
export async function getMyPlayer(): Promise<Player | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("players")
    .select(
      "id, display_name, age, gender, avatar_skin, avatar_hair_style, avatar_hair_color, avatar_outfit, background_slug, interest"
    )
    .maybeSingle();
  return (data as Player | null) ?? null;
}