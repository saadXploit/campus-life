import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Records which provider accounts (X, Google) belong to this player.
 * - Data comes from Supabase's verified session, never from the browser.
 * - We keep the provider's permanent account ID.
 * - We only keep a handle for X (for display). Nothing personal from Google.
 * - If an identity already exists, it is left untouched (never reassigned).
 */
export async function syncIdentities(user: User): Promise<void> {
  const rows = (user.identities ?? []).flatMap((identity) => {
    const data = (identity.identity_data ?? {}) as Record<string, unknown>;
    const providerUserId = asString(data.provider_id) ?? asString(data.sub);
    if (!providerUserId) return [];

    const isX = identity.provider === "x" || identity.provider === "twitter";
    const handle = isX
      ? asString(data.user_name) ?? asString(data.preferred_username)
      : null;

    return [
      {
        user_id: user.id,
        provider: identity.provider,
        provider_user_id: providerUserId,
        handle,
      },
    ];
  });

  if (rows.length === 0) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("auth_identities")
    .upsert(rows, { onConflict: "provider,provider_user_id", ignoreDuplicates: true });

  if (error) console.error("Could not record identity:", error.message);
}