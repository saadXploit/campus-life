import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getStaffRole } from "@/lib/auth/guards";
import { syncIdentities } from "@/lib/auth/identities";
import { bootstrapOwnerIfEligible, getXIdentity } from "@/lib/auth/staff";
import { logAdminAction } from "@/lib/auth/audit";

/** Where X sends admins back after they approve the login. */
export async function GET(request: NextRequest) {
  const site = getServerEnv().NEXT_PUBLIC_SITE_URL;
  const refuse = (code: string) =>
    NextResponse.redirect(`${site}/admin/login?error=${code}`);

  const code = new URL(request.url).searchParams.get("code");
  if (!code) return refuse("failed");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return refuse("failed");

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return refuse("failed");

  await syncIdentities(user);

  // Staff must have a verified X account.
  const x = getXIdentity(user);
  const active = await getCurrentUser();
  if (!x || !active) {
    await supabase.auth.signOut();
    return refuse("not_authorised");
  }

  // Creates the OWNER only if the verified X ID matches the server setting.
  await bootstrapOwnerIfEligible(user);

  const role = await getStaffRole(user.id);
  if (!role) {
    await supabase.auth.signOut();
    return refuse("not_authorised");
  }

  await logAdminAction({
    actorUserId: user.id,
    actorHandle: x.handle,
    action: "ADMIN_LOGIN",
    targetType: "staff",
    targetId: user.id,
    metadata: { role },
  });

  return NextResponse.redirect(`${site}/admin`);
}