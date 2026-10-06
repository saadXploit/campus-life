import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The "admin pass": a signed cookie that is separate from the normal login.
 * It is valid only if ALL of these are true:
 *  - the signature matches (so editing it in the browser breaks it),
 *  - it belongs to this user,
 *  - it is less than ADMIN_SESSION_HOURS old,
 *  - it was issued after the last "revoke" for this staff member.
 */
export const ADMIN_COOKIE = "cl_admin";
export const ADMIN_SESSION_HOURS = 8;

function sign(payload: string): string {
  return createHmac("sha256", getServerEnv().ADMIN_SESSION_SECRET)
    .update(payload)
    .digest("hex");
}

export async function startAdminSession(userId: string): Promise<void> {
  const payload = `${userId}.${Date.now()}`;
  const store = await cookies();
  store.set(ADMIN_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.round(ADMIN_SESSION_HOURS * 3600),
  });
}

export async function endAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

export async function hasValidAdminSession(userId: string): Promise<boolean> {
  const store = await cookies();
  const raw = store.get(ADMIN_COOKIE)?.value;
  if (!raw) return false;

  const parts = raw.split(".");
  if (parts.length !== 3) return false;
  const [cookieUserId, issued, signature] = parts;
  if (cookieUserId !== userId) return false;

  const given = Buffer.from(signature, "hex");
  const expected = Buffer.from(sign(`${cookieUserId}.${issued}`), "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;

  const issuedAt = Number(issued);
  if (!Number.isFinite(issuedAt)) return false;
  const age = Date.now() - issuedAt;
  if (age < 0 || age > ADMIN_SESSION_HOURS * 3600 * 1000) return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from("staff_roles")
    .select("sessions_valid_after")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return false;

  return issuedAt >= new Date(data.sessions_valid_after).getTime();
}

/** Invalidates every admin pass issued so far for this person. */
export async function revokeAdminSessions(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("staff_roles")
    .update({ sessions_valid_after: new Date().toISOString() })
    .eq("user_id", userId);
}