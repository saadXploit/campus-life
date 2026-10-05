import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasMinRole, isStaffRole, type StaffRole } from "./roles";

/**
 * The signed-in player, verified with Supabase's auth server.
 * Returns null if not signed in, or if the account is suspended or banned.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") return null;
  return data.user;
}

/** Page guard for players: sends visitors to /login if not signed in. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * The staff role stored in OUR database for this user.
 * Returns null for normal players and for suspended staff.
 */
export async function getStaffRole(userId: string): Promise<StaffRole | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("staff_roles")
    .select("role, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data || data.status !== "active" || !isStaffRole(data.role)) return null;
  return data.role;
}

/**
 * Page/action guard for staff. Everyone who is not authorised is sent
 * to /admin/login. The role always comes from the database, never the browser.
 */
export async function requireStaff(
  minRole: StaffRole = "MODERATOR"
): Promise<{ user: User; role: StaffRole }> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");

  const role = await getStaffRole(user.id);
  if (!role || !hasMinRole(role, minRole)) redirect("/admin/login");

  return { user, role };
}