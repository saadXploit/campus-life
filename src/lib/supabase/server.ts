import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";

/**
 * Supabase connection for SERVER code, acting as the signed-in player.
 * It reads the login session from secure cookies.
 * It still obeys the database's Row Level Security rules.
 */
export async function createClient() {
  const env = getServerEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a page where cookies cannot be written.
            // Safe to ignore: our request gate refreshes sessions.
          }
        },
      },
    }
  );
}