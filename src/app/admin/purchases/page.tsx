import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { formatNaira } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The moment 30 days ago (outside the component, so rendering stays pure). */
function thirtyDaysAgo(): string {
  return new Date(Date.now() - 30 * 86_400_000).toISOString();
}

const STATUS_COLORS: Record<string, string> = {
  paid: "text-emerald-300",
  pending: "text-zinc-400",
  failed: "text-red-300",
  refunded: "text-amber-300",
};

/** Real-money shop orders, newest first. Refunds are made in the Paystack dashboard. */
export default async function PurchasesPage() {
  // Server-side check. Only SUPER_ADMIN and OWNER get past this line.
  await requireStaff("SUPER_ADMIN");

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("purchases")
    .select("reference, amount_kobo, status, failure, created_at, paid_at, item_slug, players(display_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  const since = thirtyDaysAgo();
  const { data: month } = await admin
    .from("purchases")
    .select("amount_kobo")
    .eq("status", "paid")
    .gte("paid_at", since);
  const monthTotal = (month ?? []).reduce((sum, r) => sum + Number(r.amount_kobo), 0);

  return (
    <main className="min-h-screen bg-[#070a14] px-5 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin" className="text-sm text-zinc-400 hover:text-white">
          Back to dashboard
        </Link>
        <p className="mt-6 text-sm font-semibold tracking-[0.3em] text-red-400">CAMPUS LIFE STAFF</p>
        <h1 className="mt-3 text-3xl font-extrabold">Shop purchases</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Real-money orders paid through Paystack. Paid in the last 30 days:{" "}
          <span className="font-bold text-emerald-300">{formatNaira(monthTotal)}</span>. Refunds are made in the
          Paystack dashboard using the CL- reference.
        </p>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs text-zinc-400">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Student</th>
                <th className="p-3">Item</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Reference</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r) => {
                const player = r.players as unknown as { display_name: string } | null;
                return (
                  <tr key={r.reference} className="border-t border-white/5">
                    <td className="p-3 whitespace-nowrap text-zinc-400">{formatTime(r.created_at)}</td>
                    <td className="p-3">{player?.display_name ?? "?"}</td>
                    <td className="p-3">{r.item_slug}</td>
                    <td className="p-3">{formatNaira(Number(r.amount_kobo))}</td>
                    <td className={"p-3 " + (STATUS_COLORS[r.status] ?? "")} title={r.failure ?? ""}>
                      {r.status}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-zinc-500">{r.reference}</td>
                  </tr>
                );
              })}
              {(rows ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-zinc-500">
                    No purchases yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
