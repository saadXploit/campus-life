"use server";

import { z } from "zod";
import { requirePlayerId } from "@/lib/auth/guards";
import type { GameDynamic } from "@/lib/game/gameTypes";
import { createAdminClient } from "@/lib/supabase/admin";

// Driving your car and giving friends a lift. One database call each.

export type RideResult = {
  dynamic?: GameDynamic & { ride_id?: string | null; ride_kind?: string; curfew_fine?: boolean };
  error?: string;
};

const ERRORS: Record<string, string> = {
  "ride: no car": "You need a car to drive. Get one in the shop.",
  "ride: too many": "Your car only has room for 3 friends.",
  "ride: no offer": "That lift is no longer available.",
  "ride: expired": "That lift has already left.",
  "not friends": "You can only offer lifts to friends.",
  "unknown location": "That place does not exist.",
  "too tired": "You are too tired to drive.",
  busy: "You are in the middle of something. Wait for it to finish.",
  asleep: "You are asleep. Wake up first.",
  curfew: "Curfew! The gate is locked and you cannot pay the gate fine.",
  "slow down": "Slow down a little and try again.",
  blocked: "This account cannot play right now.",
};

async function call(fn: string, args: Record<string, unknown>): Promise<RideResult> {
  const { data, error } = await createAdminClient().rpc(fn, args);
  if (error) {
    const known = Object.keys(ERRORS).find((k) => error.message.includes(k));
    if (known) return { error: ERRORS[known] };
    console.error(`${fn} failed:`, error.message);
    return { error: "Something went wrong. Please try again." };
  }
  return { dynamic: data as RideResult["dynamic"] };
}

export async function driveAction(locationId: string, friends: string[]): Promise<RideResult> {
  const userId = await requirePlayerId();
  const parsed = z.object({ to: z.string().uuid(), friends: z.array(z.string().uuid()).max(7) }).safeParse({ to: locationId, friends });
  if (!parsed.success) return { error: "Pick where to drive." };
  return call("drive_to", { p_user_id: userId, p_location: parsed.data.to, p_friends: parsed.data.friends });
}

export async function respondRideAction(rideId: string, accept: boolean): Promise<RideResult> {
  const userId = await requirePlayerId();
  if (!z.string().uuid().safeParse(rideId).success) return { error: "That lift is no longer available." };
  return call("respond_ride", { p_user_id: userId, p_ride: rideId, p_accept: accept === true });
}
