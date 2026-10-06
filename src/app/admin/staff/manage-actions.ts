"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/guards";
import { canAssignRole, canModifyStaffMember } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/lib/auth/audit";
import { getXIdentity } from "@/lib/auth/staff";

const uuid = z.string().uuid();

/**
 * Shared safety checks for every staff change:
 *  1. The caller must be the OWNER (checked on the server, every time).
 *  2. The target must be a real staff member who is not the OWNER.
 */
async function guardedTarget(formData: FormData) {
  const { user, role: actorRole } = await requireStaff("OWNER");

  const id = uuid.safeParse(formData.get("user_id"));
  if (!id.success) redirect("/admin/staff?error=invalid");

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("staff_roles")
    .select("user_id, role, status")
    .eq("user_id", id.data)
    .maybeSingle();

  if (!target || !canModifyStaffMember(actorRole, target.role)) {
    redirect("/admin/staff?error=not_allowed");
  }

  return { actor: user, actorRole, admin, target };
}

async function targetHandle(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("auth_identities")
    .select("handle")
    .eq("user_id", userId)
    .in("provider", ["x", "twitter"])
    .maybeSingle();
  return data?.handle ?? null;
}

export async function changeRoleAction(formData: FormData): Promise<void> {
  const { actor, actorRole, admin, target } = await guardedTarget(formData);

  const newRole = String(formData.get("role") ?? "");
  if (!canAssignRole(actorRole, newRole)) redirect("/admin/staff?error=not_allowed");
  if (newRole === target.role) redirect("/admin/staff");

  const { error } = await admin
    .from("staff_roles")
    .update({ role: newRole })
    .eq("user_id", target.user_id);
  if (error) redirect("/admin/staff?error=failed");

  await logAdminAction({
    actorUserId: actor.id,
    actorHandle: getXIdentity(actor)?.handle ?? null,
    action: "STAFF_ROLE_CHANGED",
    targetType: "staff",
    targetId: target.user_id,
    reason: (await targetHandle(target.user_id)) ?? undefined,
    metadata: { from: target.role, to: newRole },
  });

  revalidatePath("/admin/staff");
  redirect("/admin/staff");
}

export async function setStatusAction(formData: FormData): Promise<void> {
  const { actor, admin, target } = await guardedTarget(formData);

  const status = String(formData.get("status") ?? "");
  if (status !== "active" && status !== "suspended") redirect("/admin/staff?error=invalid");
  if (status === target.status) redirect("/admin/staff");

  const { error } = await admin
    .from("staff_roles")
        .update({ status, sessions_valid_after: new Date().toISOString() })    .eq("user_id", target.user_id);
  if (error) redirect("/admin/staff?error=failed");

  await logAdminAction({
    actorUserId: actor.id,
    actorHandle: getXIdentity(actor)?.handle ?? null,
    action: status === "suspended" ? "STAFF_SUSPENDED" : "STAFF_REACTIVATED",
    targetType: "staff",
    targetId: target.user_id,
    reason: (await targetHandle(target.user_id)) ?? undefined,
    metadata: { role: target.role },
  });

  revalidatePath("/admin/staff");
  redirect("/admin/staff");
}

export async function removeStaffAction(formData: FormData): Promise<void> {
  const { actor, admin, target } = await guardedTarget(formData);

  const { error } = await admin
    .from("staff_roles")
    .delete()
    .eq("user_id", target.user_id);
  if (error) redirect("/admin/staff?error=failed");

  await logAdminAction({
    actorUserId: actor.id,
    actorHandle: getXIdentity(actor)?.handle ?? null,
    action: "STAFF_REMOVED",
    targetType: "staff",
    targetId: target.user_id,
    reason: (await targetHandle(target.user_id)) ?? undefined,
    metadata: { role: target.role },
  });

  revalidatePath("/admin/staff");
  redirect("/admin/staff");
}