import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { setAdStatusAction } from "./actions";

const PLACEMENT: Record<string, string> = {
  billboard: "🪧 Billboard",
  club_song: "🎵 Club song",
  market_product: "🛒 Market product",
};

const ERRORS: Record<string, string> = {
  not_allowed: "Your role cannot manage ads.",
  invalid: "Something was wrong with that request.",
  failed: "That could not be saved. Nothing was changed.",
};

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The date 7 days ago (YYYY-MM-DD), for the stats window. */
function weekAgo(): string {
  return new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
}

function nowMillis(): number {
  return Date.now();
}

type AdRow = {
  id: string;
  placement: string;
  title: string;
  advertiser: string;
  headline: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  bg_color: string;
  fg_color: string;
};

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; show?: string }>;
}) {
  // Server-side check. ADMIN and above get past this line.
  await requireStaff("ADMIN");
  const { error, saved, show } = await searchParams;
  const showArchived = show === "archived";

  const admin = createAdminClient();
  let query = admin
    .from("ads")
    .select("id, placement, title, advertiser, headline, status, starts_at, ends_at, bg_color, fg_color")
    .order("updated_at", { ascending: false })
    .limit(100);
  query = showArchived ? query.eq("status", "archived") : query.neq("status", "archived");
  const { data } = await query;
  const ads = (data ?? []) as AdRow[];

  // Views and clicks over the last 7 days.
  const since = weekAgo();
  const { data: stats } = ads.length
    ? await admin
        .from("ad_daily_stats")
        .select("ad_id, impressions, clicks")
        .in("ad_id", ads.map((a) => a.id))
        .gte("day", since)
    : { data: [] };
  const totals = new Map<string, { views: number; clicks: number }>();
  for (const s of stats ?? []) {
    const t = totals.get(s.ad_id) ?? { views: 0, clicks: 0 };
    t.views += s.impressions;
    t.clicks += s.clicks;
    totals.set(s.ad_id, t);
  }

  const nowMs = nowMillis();
  const small = "rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10";

  return (
    <main className="min-h-screen bg-[#070a14] px-5 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin" className="text-sm text-zinc-400 hover:text-white">
          Back to dashboard
        </Link>
        <p className="mt-6 text-sm font-semibold tracking-[0.3em] text-red-400">CAMPUS LIFE STAFF</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold">Ads</h1>
          <Link href="/admin/ads/new" className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold">
            + New ad
          </Link>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          Ads show in the game only while <b>active</b> and inside their dates. With no live ad, players
          see the game&apos;s own poster.
        </p>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {ERRORS[error] ?? ERRORS.failed}
          </p>
        )}
        {saved && (
          <p className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            Ad saved.
          </p>
        )}

        <div className="mt-4 flex gap-2 text-sm">
          <Link href="/admin/ads" className={showArchived ? small : small + " bg-white/10"}>
            Current
          </Link>
          <Link href="/admin/ads?show=archived" className={showArchived ? small + " bg-white/10" : small}>
            Archived
          </Link>
        </div>

        {ads.length === 0 && (
          <p className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-400">No ads here yet.</p>
        )}

        <div className="mt-4 space-y-3">
          {ads.map((ad) => {
            const t = totals.get(ad.id) ?? { views: 0, clicks: 0 };
            const scheduled =
              ad.status === "active" &&
              ((ad.starts_at && Date.parse(ad.starts_at) > nowMs) || (ad.ends_at && Date.parse(ad.ends_at) <= nowMs));
            return (
              <div key={ad.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-20 items-center justify-center rounded-lg px-1 text-center text-[10px] font-black uppercase leading-tight"
                      style={{ backgroundColor: ad.bg_color, color: ad.fg_color }}
                    >
                      {ad.headline}
                    </div>
                    <div>
                      <p className="font-bold">{ad.title}</p>
                      <p className="text-xs text-zinc-400">
                        {PLACEMENT[ad.placement]} · {ad.advertiser}
                      </p>
                    </div>
                  </div>
                  <span
                    className={
                      "rounded-full px-3 py-1 text-xs font-bold " +
                      (ad.status === "active" && !scheduled
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-white/10 text-zinc-300")
                    }
                  >
                    {scheduled ? "scheduled / ended" : ad.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  {formatTime(ad.starts_at)} → {formatTime(ad.ends_at)} · last 7 days: {t.views} views, {t.clicks} clicks
                  {t.views > 0 ? ` (${((t.clicks / t.views) * 100).toFixed(1)}%)` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/admin/ads/${ad.id}`} className={small}>
                    Edit
                  </Link>
                  {(["active", "paused", "archived"] as const)
                    .filter((st) => st !== ad.status)
                    .map((st) => (
                      <form key={st} action={setAdStatusAction}>
                        <input type="hidden" name="id" value={ad.id} />
                        <input type="hidden" name="status" value={st} />
                        <button type="submit" className={small}>
                          {st === "active" ? "Activate" : st === "paused" ? "Pause" : "Archive"}
                        </button>
                      </form>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
