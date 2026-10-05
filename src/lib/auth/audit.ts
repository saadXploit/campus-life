import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type AuditEntry = {
  actorUserId: string | null;
  actorHandle: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Writes one line to the audit log (append-only in the database).
 * Every important admin action goes through here.
 */
export async function logAdminAction(entry: AuditEntry): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("admin_actions").insert({
    actor_user_id: entry.actorUserId,
    actor_handle: entry.actorHandle,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    reason: entry.reason ?? null,
    metadata: entry.metadata ?? {},
  });
  if (error) console.error("Audit log write failed:", error.message);
}