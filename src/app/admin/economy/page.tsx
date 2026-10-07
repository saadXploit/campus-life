import Link from "next/link";
import ConfirmButton from "@/components/ConfirmButton";
import { requireStaff } from "@/lib/auth/guards";
import { formatNaira } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { adjustWalletAction } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "Please check the form. The reason must be at least 5 characters.",
  no_player: "No student has that exact name.",
  overdraw: "That student does not have enough money for that debit.",
  not_allowed: "You are not allowed to do that.",
  failed: "Something went wrong. No money was moved.",
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

export default async function EconomyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  // Server-side check. Only SUPER_ADMIN and OWNER get past this line.
  await requireStaff("SUPER_ADMIN");
  const { error, done } = await searchParams;

  const admin = createAdminClient();
  const { data: recent } = await admin
    .from("admin_actions")
    .select("id, actor_handle, reason, metadata, created_at")
    .eq("action", "ECONOMY_ADJUSTMENT")
    .order("id", { ascending: false })
    .limit(15);

  const field =
    "mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-red-400";

  return (
    <main className="min-h-screen bg-[#070a14] px-5 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/admin" className="text-sm text-zinc-400 hover:text-white">
          Back to dashboard
        </Link>
        <p className="mt-6 text-sm font-semibold tracking-[0.3em] text-red-400">CAMPUS LIFE STAFF</p>
        <h1 className="mt-3 text-3xl font-extrabold">Economy</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Credit or debit a student&apos;s wallet. Every change needs a reason, is written to their
          money history and the audit log, and the student is notified.
        </p>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {ERRORS[error] ?? ERRORS.failed}
          </p>
        )}
        {done && (
          <p className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            Done. The student has been notified.
          </p>
        )}

        <form action={adjustWalletAction} className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <label className="block text-sm text-zinc-300">
            Student name (exact)
            <input name="player" required minLength={3} maxLength={20} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm text-zinc-300">
              Type
              <select name="direction" defaultValue="credit" className={field}>
                <option value="credit">Credit (add)</option>
                <option value="debit">Debit (remove)</option>
              </select>
            </label>
            <label className="block text-sm text-zinc-300">
              Amount (₦)
              <input name="amount" type="number" min={1} max={10000000} required className={field} />
            </label>
          </div>
          <label className="block text-sm text-zinc-300">
            Reason (the student sees this)
            <input name="reason" required minLength={5} maxLength={200} placeholder="e.g. Refund for bug #12" className={field} />
          </label>
          <ConfirmButton
            message="Move this money? This is recorded permanently."
            className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white"
          >
            Apply
          </ConfirmButton>
        </form>

        <h2 className="mt-8 text-lg font-bold">Recent adjustments</h2>
        <div className="mt-3 space-y-2">
          {(recent ?? []).length === 0 && <p className="text-sm text-zinc-500">None yet.</p>}
          {(recent ?? []).map((r) => {
            const m = (r.metadata ?? {}) as { amount_kobo?: number; player?: string };
            const amount = Number(m.amount_kobo ?? 0);
            return (
              <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold">{m.player ?? "Student"}</span>
                  <span className={amount > 0 ? "font-bold text-emerald-300" : "font-bold text-red-300"}>
                    {amount > 0 ? "+" : "-"}
                    {formatNaira(Math.abs(amount))}
                  </span>
                </div>
                <p className="text-zinc-400">{r.reason}</p>
                <p className="text-xs text-zinc-500">
                  {r.actor_handle ? `@${r.actor_handle}` : "staff"} · {formatTime(r.created_at)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
