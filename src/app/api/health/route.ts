import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";

// TEMPORARY test route. We delete this before Stage 1 is finished.
export async function GET() {
  try {
    const env = getServerEnv();
    const res = await fetch(
      `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
      { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY } }
    );
    return NextResponse.json({
      envOk: true,
      supabaseReachable: res.ok,
      supabaseStatus: res.status,
      ownerConfigured: Boolean(env.OWNER_X_USER_ID),
    });
  } catch (e) {
    return NextResponse.json(
      { envOk: false, error: e instanceof Error ? e.message : "unknown error" },
      { status: 500 }
    );
  }
}