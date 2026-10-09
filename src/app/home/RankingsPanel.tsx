"use client";

import { useEffect, useState } from "react";
import { fetchFeed } from "@/lib/game/feed";
import type { RankRow, Rankings } from "@/lib/game/life";
import { formatNaira } from "@/lib/money";

type Tab = "richest" | "top_cgpa" | "most_friends";

const TABS: { key: Tab; label: string }[] = [
  { key: "richest", label: "💰 Richest" },
  { key: "top_cgpa", label: "🎓 Top CGPA" },
  { key: "most_friends", label: "👥 Most friends" },
];

/** Rankings at your university. Players who turned off suggestions are not listed. */
export default function RankingsPanel({ university, onClose }: { university: string; onClose: () => void }) {
  const [data, setData] = useState<Rankings | null>(null);
  const [tab, setTab] = useState<Tab>("richest");

  useEffect(() => {
    let live = true;
    void fetchFeed<Rankings>("rankings").then((r) => live && setData(r));
    return () => {
      live = false;
    };
  }, []);

  const show = (row: RankRow) =>
    tab === "richest" ? formatNaira(Number(row.value)) : tab === "top_cgpa" ? Number(row.value).toFixed(2) : `${row.value} friends`;
  const rows = data?.[tab] ?? [];
  const mine =
    tab === "richest"
      ? data && `You're #${data.me.rich_rank} · ${formatNaira(Number(data.me.balance))}`
      : tab === "top_cgpa"
        ? data && (data.me.cgpa_rank ? `You're #${data.me.cgpa_rank} · CGPA ${Number(data.me.cgpa).toFixed(2)}` : "You don't have a CGPA yet")
        : data && `You have ${data.me.friends} friends`;

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#10172e] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-amber-300">🏆 RANKINGS</p>
            <p className="text-xl font-extrabold">{university}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl text-zinc-400">
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1 text-xs font-semibold">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={"rounded-lg py-2 " + (tab === t.key ? "bg-white/15" : "text-zinc-400")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {mine && <p className="mt-3 rounded-xl bg-amber-400/10 p-2 text-center text-sm font-bold text-amber-200">{mine}</p>}

        {!data ? (
          <p className="mt-6 text-center text-sm text-zinc-400">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="mt-6 text-center text-sm text-zinc-400">No one here yet.</p>
        ) : (
          <ol className="mt-3 space-y-1.5">
            {rows.map((r, i) => (
              <li
                key={r.id}
                className={
                  "flex items-center justify-between rounded-xl px-3 py-2 text-sm " +
                  (r.me ? "bg-emerald-400/15 font-bold" : "bg-white/5")
                }
              >
                <span>
                  <span className="mr-2 inline-block w-6 text-zinc-400">{i < 3 ? ["🥇", "🥈", "🥉"][i] : `${i + 1}.`}</span>
                  {r.name}
                  {r.me && " (you)"}
                </span>
                <span className="font-semibold text-emerald-300">{show(r)}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 text-[11px] text-zinc-500">
          Players who turned off &quot;Show me in suggestions&quot; are not listed.
        </p>
      </div>
    </div>
  );
}
