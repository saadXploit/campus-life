import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

/**
 * POWERFUL Supabase connection using the SECRET key.
 * It bypasses Row Level Security, so use it ONLY in trusted server code,
 * and ONLY after checking the caller is allowed (see auth guards, coming soon).
 * Never import this file from anything that runs in the browser.
 */
export function createAdminClient() {
  const env = getServerEnv();

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}