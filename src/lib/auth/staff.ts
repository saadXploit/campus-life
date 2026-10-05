import "server-only";
import type { User } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "./audit";

/** The verified X account attached to this login session, if any. */
export function getXIdentity(
  user: User
): { providerUserId: string; handle: string | null } | null {
  for (const identity of user.identities ?? []) {
    if (identity.provider !== "x" && identity.provider !== "twitter") continue;
    const data = (identity.identity_data ?? {}) as Record<string, unknown>;
    const id =
      typeof data.provider_id === "string"
        ? data.provider_id
        : typeof data.sub === "string"
          ? data.sub
          : null;
    if (!id) continue;
    const handle =
      typeof data.user_name === "string"
        ? data.user_name
        : typeof data.preferred_username === "string"
          ? data.preferred_username
          : null;
    return { providerUserId: id, handle };
  }
  return null;
}

/**
 * Creates the OWNER, but ONLY when ALL of these are true:
 *  - OWNER_X_USER_ID is set in the server settings,
 *  - the person signed in with X, verified by Supabase's OAuth session,
 *  - their numeric X ID matches OWNER_X_USER_ID exactly.
 * A username typed or sent by a browser is never used.
 * The database also allows only one OWNER ever, and blocks every change to it.
 */
export async function bootstrapOwnerIfEligible(user: User): Promise<void> {
  const ownerId = getServerEnv().OWNER_X_USER_ID;
  if (!ownerId) return; // fail closed: nobody becomes OWNER

  const x = getXIdentity(user);
  if (!x || x.providerUserId !== ownerId) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("staff_roles")
    .insert({ user_id: user.id, role: "OWNER", status: "active" });

  if (error) return; // already exists, or the database refused it

  await logAdminAction({
    actorUserId: user.id,
    actorHandle: x.handle,
    action: "OWNER_ACTIVATED",
    targetType: "staff",
    targetId: user.id,
    reason: "First sign-in by the configured owner X account",
  });
}