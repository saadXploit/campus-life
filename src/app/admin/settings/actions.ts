"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/guards";
import { logAdminAction } from "@/lib/auth/audit";
import { can } from "@/lib/auth/roles";
import { getXIdentity } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  registration_open: z.enum(["true", "false"]),
  shop_open: z.enum(["true", "false"]),
  transfer_min_account_age_hours: z.coerce.number().int().min(0).max(720),
  transfer_max_naira: z.coerce.number().int().min(1).max(100_000_000),
  transfer_daily_max_naira: z.coerce.number().int().min(1).max(1_000_000_000),
  transfer_daily_count: z.coerce.number().int().min(1).max(1000),
  room_capacity: z.coerce.number().int().min(2).max(200),
  visible_strangers: z.coerce.number().int().min(0).max(50),
  visible_friends: z.coerce.number().int().min(1).max(100),
  presence_seconds: z.coerce.number().int().min(30).max(600),
  job_pay_percent: z.coerce.number().int().min(10).max(300),
  job_daily_shifts: z.coerce.number().int().min(1).max(10),
  job_change_hours: z.coerce.number().int().min(0).max(168),
});

export async function saveSettingsAction(formData: FormData): Promise<void> {
  const { user, role } = await requireStaff("SUPER_ADMIN");
  if (!can(role, "settings.manage")) redirect("/admin/settings?error=not_allowed");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/settings?error=invalid");
  const v = parsed.data;

  const values: Record<string, unknown> = {
    registration_open: v.registration_open === "true",
    shop_open: v.shop_open === "true",
    transfer_min_account_age_hours: v.transfer_min_account_age_hours,
    transfer_max_kobo: v.transfer_max_naira * 100,
    transfer_daily_max_kobo: v.transfer_daily_max_naira * 100,
    transfer_daily_count: v.transfer_daily_count,
    room_capacity: v.room_capacity,
    visible_strangers: v.visible_strangers,
    visible_friends: v.visible_friends,
    presence_seconds: v.presence_seconds,
    job_pay_percent: v.job_pay_percent,
    job_daily_shifts: v.job_daily_shifts,
    job_change_hours: v.job_change_hours,
  };

  const admin = createAdminClient();
  const { data: before } = await admin.from("app_config").select("key, value");
  const old = new Map((before ?? []).map((r) => [r.key as string, r.value]));
  const changed = Object.entries(values).filter(([k, val]) => old.get(k) !== val);
  if (changed.length === 0) redirect("/admin/settings?saved=1");

  const now = new Date().toISOString();
  const { error } = await admin.from("app_config").upsert(
    changed.map(([key, value]) => ({ key, value, updated_by: user.id, updated_at: now }))
  );
  if (error) redirect("/admin/settings?error=failed");

  await logAdminAction({
    actorUserId: user.id,
    actorHandle: getXIdentity(user)?.handle ?? null,
    action: "SETTINGS_UPDATED",
    targetType: "app_config",
    metadata: Object.fromEntries(changed.map(([k, val]) => [k, { from: old.get(k), to: val }])),
  });

  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=1");
}
