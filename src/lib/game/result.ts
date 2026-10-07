import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type MyResult = {
  application_id: string;
  outcome: "admitted" | "offer" | "rejected";
  choice_rank: number | null;
  offer_response: "accepted" | "declined" | null;
  reapply_at: string | null;
  universities: {
    name: string;
    short_name: string;
    slug: string;
    primary_color: string;
    secondary_color: string;
    tuition_per_semester_kobo: number;
  } | null;
  courses: { name: string; code: string } | null;
};

/** Asks the server to reveal the result. It only acts once, and only when the time has come. */
export async function revealResult(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("reveal_result", { p_user_id: userId });
  if (error) console.error("reveal_result failed:", error.message);
}

export async function respondToOffer(userId: string, accept: boolean): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.rpc(accept ? "accept_offer" : "decline_offer", {
    p_user_id: userId,
  });
  if (error) {
    console.error("respondToOffer failed:", error.message);
    return false;
  }
  return true;
}

/** The player's most recent result. The database only returns their own. */
export async function getMyLatestResult(): Promise<MyResult | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("application_results")
    .select(
      "application_id, outcome, choice_rank, offer_response, reapply_at, universities(name, short_name, slug, primary_color, secondary_color, tuition_per_semester_kobo), courses(name, code)"
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as MyResult | null) ?? null;
}