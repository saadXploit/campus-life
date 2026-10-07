import Link from "next/link";
import ConfirmButton from "@/components/ConfirmButton";
import { requireStaff } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { declareStrikeAction, endStrikeAction } from "./actions";

const ERRORS: Record<string, string> = {
  not_allowed: "Your role cannot do that.",
  invalid: "Please check the form (reason of at least 3 characters, 1 to 60 days).",
  failed: "That could not be saved. Nothing was changed.",
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

function nowIso(): string {
  return new Date().toISOString();
}

export default async function AcademicsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  // Server-side check. SUPER_ADMIN and OWNER get past this line.
  await requireStaff("SUPER_ADMIN");
  const { error, done } = await searchParams;

  const admin = createAdminClient();
  const [{ data: universities }, { data: strikes }] = await Promise.all([
    admin.from("universities").select("id, name, type").order("name"),
    admin
      .from("strikes")
      .select("id, university_id, university_type, starts_at, ends_at, reason")
      .gt("ends_at", nowIso())
      .order("starts_at", { ascending: false }),
  ]);
  const nameOf = new Map((universities ?? []).map((u) => [u.id as string, u.name as string]));

  const field =
    "mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-red-400";

  return (
    <main className="min-h-screen bg-[#070a14] px-5 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/admin" className="text-sm text-zinc-400 hover:text-white">
          Back to dashboard
        </Link>
        <p className="mt-6 text-sm font-semibold tracking-[0.3em] text-red-400">CAMPUS LIFE STAFF</p>
        <h1 className="mt-3 text-3xl font-extrabold">Academics</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Semesters run on real Nigerian time: 3 weeks of lectures, 1 exam week, 1 week of holiday. During a strike,
          lectures stop and missed lectures do not count against students.
        </p>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {ERRORS[error] ?? ERRORS.failed}
          </p>
        )}
        {done && (
          <p className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            Strike declared. Students will see it in their academics.
          </p>
        )}

        <h2 className="mt-8 text-lg font-bold">Strikes in force</h2>
        <div className="mt-3 space-y-2">
          {(strikes ?? []).length === 0 && <p className="text-sm text-zinc-500">No strikes right now.</p>}
          {(strikes ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <div>
                <p className="font-semibold">
                  {s.university_id
                    ? nameOf.get(s.university_id)
                    : s.university_type
                      ? `All ${s.university_type} universities`
                      : "Every university"}
                </p>
                <p className="text-xs text-zinc-400">
                  {s.reason} · {formatTime(s.starts_at)} → {formatTime(s.ends_at)}
                </p>
              </div>
              <form action={endStrikeAction}>
                <input type="hidden" name="id" value={s.id} />
                <ConfirmButton message="Call off this strike now?" className="rounded-lg border border-white/20 px-3 py-1.5 text-xs">
                  Call off
                </ConfirmButton>
              </form>
            </div>
          ))}
        </div>

        <form action={declareStrikeAction} className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-bold">Declare a strike</h2>
          <label className="block text-sm text-zinc-300">
            Who is on strike
            <select name="target" defaultValue="type:federal" className={field}>
              <option value="type:federal">All federal universities</option>
              <option value="type:state">All state universities</option>
              {(universities ?? []).map((u) => (
                <option key={u.id} value={`uni:${u.id}`}>
                  {u.name} ({u.type})
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm text-zinc-300">
              Starts
              <input disabled value="Now" className={field + " opacity-60"} />
            </label>
            <label className="block text-sm text-zinc-300">
              Lasts (days)
              <input name="days" type="number" min={1} max={60} defaultValue={7} className={field} />
            </label>
          </div>
          <label className="block text-sm text-zinc-300">
            Reason (students see this)
            <input name="reason" required minLength={3} maxLength={200} defaultValue="ASUU strike" className={field} />
          </label>
          <ConfirmButton
            message="Declare this strike? Lectures stop for the students affected."
            className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-bold"
          >
            Declare strike
          </ConfirmButton>
        </form>
      </div>
    </main>
  );
}
