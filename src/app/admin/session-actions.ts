"use server";

import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/guards";
import { endAdminSession, revokeAdminSessions } from "@/lib/auth/admin-session";
import { logAdminAction } from "@/lib/auth/audit";
import { getXIdentity } from "@/lib/auth/staff";

/** Signs the current staff member out of every admin session on every device. */
export async function revokeMySessionsAction(): Promise<void> {
  const { user } = await requireStaff();

  await revokeAdminSessions(user.id);
  await endAdminSession();

  await logAdminAction({
    actorUserId: user.id,
    actorHandle: getXIdentity(user)?.handle ?? null,
    action: "ADMIN_SESSIONS_REVOKED",
    targetType: "staff",
    targetId: user.id,
  });

  redirect("/admin/login");
}