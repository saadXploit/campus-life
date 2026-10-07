import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Activity = {
  slug: string;
  name: string;
  description: string;
  duration_hours: number;
  energy_delta: number;
  health_delta: number;
  happiness_delta: number;
  cost_kobo: number;
  ends_day: boolean;
};

/**
 * Every active activity (a short list), with the kind of place it happens at.
 * For display only: the server re-checks everything when one is done.
 */
export async function listActivities(): Promise<(Activity & { location_kind: string })[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select(
      "slug, name, description, location_kind, duration_hours, energy_delta, health_delta, happiness_delta, cost_kobo, ends_day"
    )
    .order("sort_order");
  return ((data ?? []) as (Activity & { location_kind: string })[]).map((a) => ({
    ...a,
    duration_hours: Number(a.duration_hours),
  }));
}
