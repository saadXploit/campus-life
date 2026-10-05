import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Signs the player out. POST only, and only from our own site. */
export async function POST(request: NextRequest) {
  const site = getServerEnv().NEXT_PUBLIC_SITE_URL;

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(site).origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${site}/`, { status: 303 });
}