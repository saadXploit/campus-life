import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { syncIdentities } from "@/lib/auth/identities";

/** Where X / Google send the player back after they approve the login. */
export async function GET(request: NextRequest) {
  const site = getServerEnv().NEXT_PUBLIC_SITE_URL;
  const code = new URL(request.url).searchParams.get("code");

  if (!code) return NextResponse.redirect(`${site}/login?error=missing_code`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${site}/login?error=auth_failed`);

  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(`${site}/login?error=auth_failed`);

  await syncIdentities(data.user);

  // Suspended or banned accounts are signed straight back out.
  const activeUser = await getCurrentUser();
  if (!activeUser) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${site}/login?error=suspended`);
  }

  // Always the same fixed destination (no redirect parameter to abuse).
  return NextResponse.redirect(`${site}/welcome`);
}