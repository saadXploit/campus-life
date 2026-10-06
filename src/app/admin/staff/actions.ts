"use server";

import { z } from "zod";
import { requireStaff } from "@/lib/auth/guards";
import { canAssignRole } from "@/lib/auth/roles";
import { createInvite } from "@/lib/auth/invites";

type InviteState = { link?: string; error?: string } | null;

const schema = z.object({
  role: z.string(),
  note: z.string().trim().max(60).optional(),
  hours: z.coerce.number().int().min(1).max(168),
});

export async function createInviteAction(
  _previous: InviteState,
  formData: FormData
): Promise<InviteState> {
  // Server-side check on every call. Only the OWNER passes.
  const { user, role: actorRole } = await requireStaff("OWNER");

  const parsed = schema.safeParse({
    role: formData.get("role"),
    note: formData.get("note") || undefined,
    hours: formData.get("hours"),
  });
  if (!parsed.success) return { error: "Please check the form and try again." };

  const { role, note, hours } = parsed.data;
  if (!canAssignRole(actorRole, role)) {
    return { error: "That role cannot be invited." };
  }

  const result = await createInvite(user, role as never, note ?? null, hours);
  return result;
}