import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 25;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  // Server-side check. Only SUPER_ADMIN and OWNER get past this line.
  await requireStaff("SUPER_ADMIN");

  const { page } = await searchParams;
  const current = Math.min(10000, Math.max(1, Number.parseInt(page ?? "1", 10) || 1));
  const from = (current - 1) * PAGE_SIZE;

  const admin = createAdminClient();
  const { data, count, error } = await admin
    .from("admin_actions")
    .select("id, actor_handle, action, target_type, reason, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const rows = data ?? [];

  return (
    <main className="min-h-screen bg-[#070a14] px-5 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/admin" className="text-sm text-zinc-400 hover:text-white">
          Back to dashboard
        </Link>
        <p className="mt-6 text-sm font-semibold tracking-[0.3em] text-red-400">
          CAMPUS LIFE STAFF
        </p>
        <h1 className="mt-3 text-3xl font-extrabold">Audit log</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Every important admin action is recorded here. Entries cannot be edited or deleted.
        </p>

        {error && (
          <p className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            Could not load the audit log.
          </p>
        )}

        {!error && rows.length === 0 && (
          <p className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-400">
            No entries yet.
          </p>
        )}

        <div className="mt-6 space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold tracking-wider text-red-300">
                  {row.action}
                </span>
                <span className="text-xs text-zinc-500">{formatTime(row.created_at)}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-300">
                By {row.actor_handle ? `@${row.actor_handle}` : "system"}
                {row.target_type ? ` on ${row.target_type}` : ""}
              </p>
              {row.reason && (
                <p className="mt-1 text-sm text-zinc-500">Reason: {row.reason}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between text-sm">
          {current > 1 ? (
            <Link
              href={`/admin/audit?page=${current - 1}`}
              className="rounded-xl border border-white/20 px-4 py-2 hover:bg-white/10"
            >
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-zinc-500">
            Page {current} of {totalPages}
          </span>
          {current < totalPages ? (
            <Link
              href={`/admin/audit?page=${current + 1}`}
              className="rounded-xl border border-white/20 px-4 py-2 hover:bg-white/10"
            >
              Older
            </Link>
          ) : (
            <span />
          )}
        </div>
      </div>
    </main>
  );
}