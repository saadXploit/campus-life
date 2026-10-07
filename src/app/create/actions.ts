"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { characterSchema } from "@/lib/game/options";
import { allowRequest } from "@/lib/rate-limit";

type State = { error: string } | null;

export async function createCharacterAction(
  _previous: State,
  formData: FormData
): Promise<State> {
  const user = await requireUser();

  if (!(await allowRequest("create-character", 20, 600, { userId: user.id }))) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const parsed = characterSchema.safeParse({
    displayName: formData.get("displayName"),
    age: formData.get("age"),
    gender: formData.get("gender"),
    skin: formData.get("skin"),
    hairStyle: formData.get("hairStyle"),
    hairColor: formData.get("hairColor"),
    outfit: formData.get("outfit"),
    background: formData.get("background"),
    interest: formData.get("interest"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }
  const c = parsed.data;

  // The server decides everything that matters (including the starting money).
  const admin = createAdminClient();
  const { error } = await admin.rpc("create_player", {
    p_user_id: user.id,
    p_display_name: c.displayName,
    p_age: c.age,
    p_gender: c.gender,
    p_skin: c.skin,
    p_hair_style: c.hairStyle,
    p_hair_color: c.hairColor,
    p_outfit: c.outfit,
    p_background: c.background,
    p_interest: c.interest,
  });

  if (error) {
    if (error.message.includes("players_display_name")) {
      return { error: "That name is already taken. Try another one." };
    }
    if (error.message.includes("players_user_id")) redirect("/welcome");
    if (error.message.includes("registration closed")) {
      return {
        error: "New student registration is paused for a short while. Please try again later.",
      };
    }
    if (error.message.includes("unknown background")) {
      return { error: "Please pick a background." };
    }
    console.error("create_player failed:", error.message);
    return { error: "Could not create your student. Please try again." };
  }

  redirect("/welcome");
}