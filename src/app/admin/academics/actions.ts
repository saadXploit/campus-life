"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/guards";
import { logAdminAction } from "@/lib/auth/audit";
import { can } from "@/lib/auth/roles";
import { getXIdentity } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/supabase/admin";

const strikeSchema = z.object({
  target: z.string().regex(/^(type:(federal|state|private)|uni:[0-9a-f-]{36}|all)$/),
  days: z.coerce.number().int().min(1).max(60),
  reason: z.string().trim().min(3).max(200),
});

export async function declareStrikeAction(formData: FormData): Promise<void> {
  const { user, role } = await requireStaff("SUPER_ADMIN");
  if (!can(role, "settings.manage")) redirect("/admin/academics?error=not_allowed");

  const parsed = strikeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/academics?error=invalid");
  const { target, days, reason } = parsed.data;

  const now = Date.now();
  const row = {
    university_id: target.startsWith("uni:") ? target.slice(4) : null,
    university_type: target.startsWith("type:") ? target.slice(5) : null,
    starts_at: new Date(now).toISOString(),
    ends_at: new Date(now + days * 86400_000).toISOString(),
    reason,
    created_by: user.id,
  };

  const admin = createAdminClient();
  const { data, error } = await admin.from("strikes").insert(row).select("id").single();
  if (error || !data) redirect("/admin/academics?error=failed");

  await logAdminAction({
    actorUserId: user.id,
    actorHandle: getXIdentity(user)?.handle ?? null,
    action: "STRIKE_DECLARED",
    targetType: "strike",
    targetId: data.id,
    reason,
    metadata: { target, days },
  });

  revalidatePath("/admin/academics");
  redirect("/admin/academics?done=1");
}

export async function endStrikeAction(formData: FormData): Promise<void> {
  const { user, role } = await requireStaff("SUPER_ADMIN");
  if (!can(role, "settings.manage")) redirect("/admin/academics?error=not_allowed");

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/admin/academics?error=invalid");

  const admin = createAdminClient();
  const { error } = await admin
    .from("strikes")
    .update({ ends_at: new Date().toISOString() })
    .eq("id", id.data)
    .gt("ends_at", new Date().toISOString());
  if (error) redirect("/admin/academics?error=failed");

  await logAdminAction({
    actorUserId: user.id,
    actorHandle: getXIdentity(user)?.handle ?? null,
    action: "STRIKE_CALLED_OFF",
    targetType: "strike",
    targetId: id.data,
  });

  revalidatePath("/admin/academics");
  redirect("/admin/academics");
}
