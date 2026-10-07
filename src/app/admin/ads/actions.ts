"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/guards";
import { logAdminAction } from "@/lib/auth/audit";
import { can } from "@/lib/auth/roles";
import { getXIdentity } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/supabase/admin";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

/** "2026-10-09T08:00" typed by staff means Lagos time (UTC+1). */
const lagosDateTime = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) {
      ctx.addIssue({ code: "custom", message: "bad date" });
      return z.NEVER;
    }
    return new Date(`${v}:00+01:00`).toISOString();
  });

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const adSchema = z.object({
  id: z.string().uuid().or(z.literal("new")),
  placement: z.enum(["billboard", "club_song", "market_product"]),
  title: z.string().trim().min(2).max(60),
  advertiser: z.string().trim().min(2).max(60),
  headline: z.string().trim().min(2).max(40),
  subline: optionalText(60),
  price_text: optionalText(20),
  bg_color: hex,
  fg_color: hex,
  destination_url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "https only")
    .transform((v) => (v === "" ? null : v)),
  university_id: z
    .string()
    .trim()
    .refine((v) => v === "" || z.string().uuid().safeParse(v).success)
    .transform((v) => (v === "" ? null : v)),
  status: z.enum(["draft", "active", "paused", "archived"]),
  starts_at: lagosDateTime,
  ends_at: lagosDateTime,
  weight: z.coerce.number().int().min(1).max(100),
});

export async function saveAdAction(formData: FormData): Promise<void> {
  const { user, role } = await requireStaff("ADMIN");
  if (!can(role, "ads.manage")) redirect("/admin/ads?error=not_allowed");

  const raw = Object.fromEntries(formData);
  const parsed = adSchema.safeParse(raw);
  const back = typeof raw.id === "string" ? raw.id : "new";
  if (!parsed.success) redirect(`/admin/ads/${back}?error=invalid`);
  const { id, ...ad } = parsed.data;
  if (ad.starts_at && ad.ends_at && ad.ends_at <= ad.starts_at) redirect(`/admin/ads/${back}?error=dates`);

  const admin = createAdminClient();
  const now = new Date().toISOString();
  let adId = id;
  if (id === "new") {
    const { data, error } = await admin
      .from("ads")
      .insert({ ...ad, created_by: user.id, updated_by: user.id })
      .select("id")
      .single();
    if (error || !data) redirect(`/admin/ads/new?error=failed`);
    adId = data.id as string;
  } else {
    const { error } = await admin
      .from("ads")
      .update({ ...ad, updated_by: user.id, updated_at: now })
      .eq("id", id);
    if (error) redirect(`/admin/ads/${id}?error=failed`);
  }

  await logAdminAction({
    actorUserId: user.id,
    actorHandle: getXIdentity(user)?.handle ?? null,
    action: id === "new" ? "AD_CREATED" : "AD_UPDATED",
    targetType: "ad",
    targetId: adId,
    metadata: { placement: ad.placement, advertiser: ad.advertiser, status: ad.status },
  });

  revalidatePath("/admin/ads");
  redirect("/admin/ads?saved=1");
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["active", "paused", "archived"]),
});

export async function setAdStatusAction(formData: FormData): Promise<void> {
  const { user, role } = await requireStaff("ADMIN");
  if (!can(role, "ads.manage")) redirect("/admin/ads?error=not_allowed");

  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/ads?error=invalid");

  const admin = createAdminClient();
  const { error } = await admin
    .from("ads")
    .update({ status: parsed.data.status, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) redirect("/admin/ads?error=failed");

  await logAdminAction({
    actorUserId: user.id,
    actorHandle: getXIdentity(user)?.handle ?? null,
    action: "AD_STATUS_CHANGED",
    targetType: "ad",
    targetId: parsed.data.id,
    metadata: { status: parsed.data.status },
  });

  revalidatePath("/admin/ads");
  redirect("/admin/ads");
}
