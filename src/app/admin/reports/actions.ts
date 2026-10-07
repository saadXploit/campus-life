"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/guards";
import { logAdminAction } from "@/lib/auth/audit";
import { can } from "@/lib/auth/roles";
import { getXIdentity } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/supabase/admin";

const reportSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(["resolved", "dismissed"]),
});

export async function closeReportAction(formData: FormData): Promise<void> {
  const { user, role } = await requireStaff("MODERATOR");
  if (!can(role, "reports.review")) redirect("/admin/reports?error=not_allowed");

  const parsed = reportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/reports?error=invalid");

  const admin = createAdminClient();
  const { error } = await admin
    .from("player_reports")
    .update({ status: parsed.data.status, resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("status", "open");
  if (error) redirect("/admin/reports?error=failed");

  await logAdminAction({
    actorUserId: user.id,
    actorHandle: getXIdentity(user)?.handle ?? null,
    action: parsed.data.status === "resolved" ? "REPORT_RESOLVED" : "REPORT_DISMISSED",
    targetType: "player_report",
    targetId: String(parsed.data.id),
  });

  revalidatePath("/admin/reports");
  redirect("/admin/reports");
}

const statusSchema = z.object({
  user_id: z.string().uuid(),
  status: z.enum(["active", "suspended", "banned"]),
  reason: z.string().trim().min(5).max(200),
});

export async function setPlayerStatusAction(formData: FormData): Promise<void> {
  const { user, role } = await requireStaff("MODERATOR");

  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/reports?error=reason");
  const { user_id, status, reason } = parsed.data;

  const needed = status === "banned" ? "players.ban" : "players.suspend";
  if (!can(role, needed)) redirect("/admin/reports?error=not_allowed");

  const admin = createAdminClient();

  // Staff accounts can only be changed by the OWNER (so a moderator cannot lock out an admin).
  const { data: staff } = await admin.from("staff_roles").select("role").eq("user_id", user_id).maybeSingle();
  if (staff && role !== "OWNER") redirect("/admin/reports?error=staff");

  // The database also refuses any change to the OWNER's account.
  const { error } = await admin.from("profiles").update({ status }).eq("id", user_id);
  if (error) redirect("/admin/reports?error=failed");

  await logAdminAction({
    actorUserId: user.id,
    actorHandle: getXIdentity(user)?.handle ?? null,
    action: status === "active" ? "PLAYER_REACTIVATED" : status === "banned" ? "PLAYER_BANNED" : "PLAYER_SUSPENDED",
    targetType: "user",
    targetId: user_id,
    reason,
  });

  revalidatePath("/admin/reports");
  redirect("/admin/reports?done=1");
}
