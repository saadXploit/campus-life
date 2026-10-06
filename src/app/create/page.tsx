import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getMyPlayer } from "@/lib/game/player";
import { createClient } from "@/lib/supabase/server";
import CharacterCreator, { type BackgroundOption } from "./CharacterCreator";

export default async function CreatePage() {
  await requireUser();
  if (await getMyPlayer()) redirect("/welcome");

  const supabase = await createClient();
  const { data } = await supabase
    .from("backgrounds")
    .select(
      "slug, name, blurb, starting_wallet_kobo, academic_bonus, hustle_bonus, social_bonus"
    )
    .order("sort_order");

  return <CharacterCreator backgrounds={(data ?? []) as BackgroundOption[]} />;
}