import Link from "next/link";
import ConfirmButton from "@/components/ConfirmButton";
import { requireStaff } from "@/lib/auth/guards";
import { can } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { closeReportAction, setPlayerStatusAction } from "./actions";

const ERRORS: Record<string, string> = {
  not_allowed: "Your role cannot do that.",
  invalid: "Something was wrong with that request.",
  reason: "Please give a reason of at least 5 characters.",
  staff: "That player is a staff member. Only the OWNER can change their account.",
  failed: "That could not be saved. Nothing was changed.",
};

const REASONS: Record<string, string> = {
  harassment: "Harassment",
  hate: "Hate",
  inappropriate: "Inappropriate",
  spam: "Spam / scam",
  cheating: "Cheating",
  other: "Other",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Row = {
  id: number;
  reason: string;
  details: string | null;
  context: { body?: string; place?: string; at?: string };
  created_at: string;
  reporter: { display_name: string } | null;
  reported: { display_name: string; user_id: string } | null;
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  // Server-side check. MODERATOR and above get past this line.
  const { role } = await requireStaff("MODERATOR");
  const { error, done } = await searchParams;

  const admin = createAdminClient();
  const { data } = await admin
    .from("player_reports")
    .select(
      "id, reason, details, context, created_at, reporter:players!player_reports_reporter_id_fkey(display_name), reported:players!player_reports_reported_id_fkey(display_name, user_id)"
    )
    .eq("status", "open")
    .order("id", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as unknown as Row[];

  const userIds = [...new Set(rows.map((r) => r.reported?.user_id).filter((v): v is string => Boolean(v)))];
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, status").in("id", userIds)
    : { data: [] };
  const statusOf = new Map((profiles ?? []).map((p) => [p.id as string, p.status as string]));

  const small = "rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10";
  const field =
    "min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-white outline-none focus:border-red-400";

  return (
    <main className="min-h-screen bg-[#070a14] px-5 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/admin" className="text-sm text-zinc-400 hover:text-white">
          Back to dashboard
        </Link>
        <p className="mt-6 text-sm font-semibold tracking-[0.3em] text-red-400">CAMPUS LIFE STAFF</p>
        <h1 className="mt-3 text-3xl font-extrabold">Player reports</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Open reports, newest first. Every decision is recorded in the audit log.
        </p>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {ERRORS[error] ?? ERRORS.failed}
          </p>
        )}
        {done && (
          <p className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            Player account updated.
          </p>
        )}

        {rows.length === 0 && (
          <p className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-400">
            No open reports. All quiet on campus.
          </p>
        )}

        <div className="mt-6 space-y-4">
          {rows.map((r) => {
            const target = r.reported;
            const status = target ? (statusOf.get(target.user_id) ?? "active") : "active";
            return (
              <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-300">
                    {REASONS[r.reason] ?? r.reason}
                  </span>
                  <span className="text-xs text-zinc-500">{formatTime(r.created_at)}</span>
                </div>
                <p className="mt-2 text-sm">
                  <span className="font-bold">{r.reporter?.display_name ?? "Someone"}</span> reported{" "}
                  <span className="font-bold">{target?.display_name ?? "a player"}</span>
                  {status !== "active" && (
                    <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-xs text-amber-300">{status}</span>
                  )}
                </p>
                {r.details && <p className="mt-1 text-sm text-zinc-300">“{r.details}”</p>}
                {r.context?.body && (
                  <p className="mt-2 rounded-lg bg-black/30 p-2 text-sm text-zinc-200">
                    They said: “{r.context.body}”
                    <span className="block text-xs text-zinc-500">
                      {r.context.place}
                      {r.context.at ? ` · ${formatTime(r.context.at)}` : ""}
                    </span>
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {(["resolved", "dismissed"] as const).map((st) => (
                    <form key={st} action={closeReportAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value={st} />
                      <button type="submit" className={small}>
                        {st === "resolved" ? "Mark resolved" : "Dismiss"}
                      </button>
                    </form>
                  ))}
                </div>

                {target && (
                  <form action={setPlayerStatusAction} className="mt-3 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="user_id" value={target.user_id} />
                    <input name="reason" required minLength={5} maxLength={200} placeholder="Reason (required)" className={field} />
                    <select name="status" defaultValue={status === "active" ? "suspended" : "active"} className={field + " flex-none"}>
                      {status !== "active" && <option value="active">Reactivate</option>}
                      {status !== "suspended" && <option value="suspended">Suspend</option>}
                      {can(role, "players.ban") && status !== "banned" && <option value="banned">Ban</option>}
                    </select>
                    <ConfirmButton
                      message={`Change ${target.display_name}'s account? This is recorded.`}
                      className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold"
                    >
                      Apply
                    </ConfirmButton>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
