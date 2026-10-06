import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "./audit";
import { ASSIGNABLE_ROLES, isStaffRole, type StaffRole } from "./roles";
import { getXIdentity } from "./staff";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isValidTokenShape(token: string): boolean {
  return /^[0-9a-f]{64}$/.test(token);
}

/**
 * Creates a one-time invite. The real token is returned ONCE (inside the link)
 * and is never stored. Only its SHA-256 fingerprint goes in the database.
 */
export async function createInvite(
  actor: User,
  role: StaffRole,
  note: string | null,
  hours: number
): Promise<{ link: string } | { error: string }> {
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return { error: "That role cannot be invited." };
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();

  const admin = createAdminClient();
  const { error } = await admin.from("staff_invites").insert({
    role,
    token_hash: hashToken(token),
    handle_note: note,
    invited_by: actor.id,
    expires_at: expiresAt,
  });
  if (error) return { error: "Could not create the invite." };

  await logAdminAction({
    actorUserId: actor.id,
    actorHandle: getXIdentity(actor)?.handle ?? null,
    action: "STAFF_INVITE_CREATED",
    targetType: "staff_invite",
    reason: note ?? undefined,
    metadata: { role, expires_at: expiresAt },
  });

  const site = getServerEnv().NEXT_PUBLIC_SITE_URL;
  return { link: `${site}/admin/invite/${token}` };
}

/** Is this token real, unused and not expired? (Does not use it up.) */
export async function isInviteUsable(token: string): Promise<boolean> {
  if (!isValidTokenShape(token)) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("staff_invites")
    .select("id")
    .eq("token_hash", hashToken(token))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return Boolean(data);
}

export type RedeemResult = "ok" | "already_staff" | "invalid" | "failed";

/**
 * Turns a valid invite into a staff role for the signed-in user.
 * The claim step is atomic: only one person can ever use a given link.
 */
export async function redeemInvite(user: User, token: string): Promise<RedeemResult> {
  if (!isValidTokenShape(token)) return "invalid";

  const admin = createAdminClient();

  // Someone who is already staff never uses up an invite.
  const { data: existing } = await admin
    .from("staff_roles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return "already_staff";

  const nowIso = new Date().toISOString();
  const { data: claimed } = await admin
    .from("staff_invites")
    .update({ used_at: nowIso, used_by: user.id })
    .eq("token_hash", hashToken(token))
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .select("id, role, invited_by")
    .maybeSingle();

  if (!claimed) return "invalid";
  if (!isStaffRole(claimed.role) || !ASSIGNABLE_ROLES.includes(claimed.role)) {
    return "failed";
  }

  const { error } = await admin.from("staff_roles").insert({
    user_id: user.id,
    role: claimed.role,
    status: "active",
    granted_by: claimed.invited_by,
  });
  if (error) return "failed";

  await logAdminAction({
    actorUserId: user.id,
    actorHandle: getXIdentity(user)?.handle ?? null,
    action: "STAFF_INVITE_REDEEMED",
    targetType: "staff",
    targetId: user.id,
    metadata: { role: claimed.role, invited_by: claimed.invited_by },
  });

  return "ok";
}