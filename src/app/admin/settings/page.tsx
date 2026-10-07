import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveSettingsAction } from "./actions";

function num(map: Map<string, unknown>, key: string, fallback: number): number {
  const v = Number(map.get(key));
  return Number.isFinite(v) ? v : fallback;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  // Server-side check. Only SUPER_ADMIN and OWNER get past this line.
  await requireStaff("SUPER_ADMIN");
  const { error, saved } = await searchParams;

  const admin = createAdminClient();
  const { data } = await admin.from("app_config").select("key, value");
  const cfg = new Map((data ?? []).map((r) => [r.key as string, r.value as unknown]));
  const registrationOpen = cfg.get("registration_open") !== false;

  const field =
    "mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-red-400";

  return (
    <main className="min-h-screen bg-[#070a14] px-5 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/admin" className="text-sm text-zinc-400 hover:text-white">
          Back to dashboard
        </Link>
        <p className="mt-6 text-sm font-semibold tracking-[0.3em] text-red-400">CAMPUS LIFE STAFF</p>
        <h1 className="mt-3 text-3xl font-extrabold">Game settings</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Changes take effect immediately and are recorded in the audit log.
        </p>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error === "invalid" ? "Some values were not valid. Nothing was changed." : "Could not save. Nothing was changed."}
          </p>
        )}
        {saved && (
          <p className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            Settings saved.
          </p>
        )}

        <form action={saveSettingsAction} className="mt-6 space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-bold">New registrations</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Pausing stops new students being created. Everyone who already has a student keeps
              playing normally.
            </p>
            <select name="registration_open" defaultValue={String(registrationOpen)} className={field}>
              <option value="true">Open</option>
              <option value="false">Paused</option>
            </select>
          </section>

          <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-bold">Money transfers between players</h2>
            <label className="block text-sm text-zinc-300">
              Account age before a player can send money (hours)
              <input
                name="transfer_min_account_age_hours"
                type="number"
                min={0}
                max={720}
                defaultValue={num(cfg, "transfer_min_account_age_hours", 24)}
                className={field}
              />
            </label>
            <label className="block text-sm text-zinc-300">
              Most a player can send at once (₦)
              <input
                name="transfer_max_naira"
                type="number"
                min={1}
                defaultValue={num(cfg, "transfer_max_kobo", 10_000_000) / 100}
                className={field}
              />
            </label>
            <label className="block text-sm text-zinc-300">
              Most a player can send in 24 hours (₦)
              <input
                name="transfer_daily_max_naira"
                type="number"
                min={1}
                defaultValue={num(cfg, "transfer_daily_max_kobo", 20_000_000) / 100}
                className={field}
              />
            </label>
            <label className="block text-sm text-zinc-300">
              Most transfers a player can make in 24 hours
              <input
                name="transfer_daily_count"
                type="number"
                min={1}
                max={1000}
                defaultValue={num(cfg, "transfer_daily_count", 20)}
                className={field}
              />
            </label>
          </section>

          <button type="submit" className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white">
            Save settings
          </button>
        </form>
      </div>
    </main>
  );
}
