import "server-only";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS } from "./time";

export type World = {
  dayNumber: number;
  weekday: string;
  nextDayAt: string;
  dayStartHour: number;
  hoursPerDay: number;
};

/** The shared campus calendar. It is worked out from the real clock, with no timers running. */
export async function getWorld(): Promise<World | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("world_clock")
    .select("epoch, day_length_minutes, day_start_hour, hours_per_day")
    .maybeSingle();
  if (!data) return null;

  const dayMs = data.day_length_minutes * 60_000;
  const epoch = new Date(data.epoch).getTime();
  const dayIndex = Math.floor(Math.max(0, Date.now() - epoch) / dayMs);

  return {
    dayNumber: dayIndex + 1,
    weekday: WEEKDAYS[dayIndex % 7],
    nextDayAt: new Date(epoch + (dayIndex + 1) * dayMs).toISOString(),
    dayStartHour: data.day_start_hour,
    hoursPerDay: data.hours_per_day,
  };
}