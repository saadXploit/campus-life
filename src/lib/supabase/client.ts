import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase connection for the BROWSER.
 * Uses only the public (publishable) key. Safe to expose.
 * What it can do is limited by the database's Row Level Security rules.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}