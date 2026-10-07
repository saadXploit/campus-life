"use client";

import { useState } from "react";
import type { GameAd } from "@/lib/game/gameTypes";
import { adClickAction } from "./ad-actions";

const KIND: Record<GameAd["placement"], string> = {
  billboard: "Billboard",
  club_song: "Now playing at the club",
  market_product: "Featured at the market",
};

/** A sponsored ad, opened from a billboard, the club screen or a market stall. */
export default function AdCard({ ad, onClose }: { ad: GameAd; onClose: () => void }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function visit() {
    setOpening(true);
    setError(null);
    // Open the tab during the tap (so popup blockers allow it), then send it on.
    const tab = window.open("about:blank", "_blank");
    const url = await adClickAction(ad.id);
    setOpening(false);
    if (!url) {
      tab?.close();
      setError("This ad is no longer available.");
      return;
    }
    if (tab) {
      tab.opener = null; // the advertiser's page cannot reach back into the game
      tab.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-[#10172e] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 text-center" style={{ backgroundColor: ad.bg_color, color: ad.fg_color }}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">{KIND[ad.placement]}</p>
          <p className="mt-2 text-3xl font-black uppercase leading-tight">{ad.headline}</p>
          {ad.subline && <p className="mt-1 text-base opacity-90">{ad.subline}</p>}
          {ad.price_text && <p className="mt-2 text-xl font-extrabold">{ad.price_text}</p>}
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-400">
            Sponsored by <span className="font-semibold text-zinc-200">{ad.advertiser}</span>
          </p>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          {ad.has_link ? (
            <>
              <button
                type="button"
                onClick={visit}
                disabled={opening}
                className="mt-4 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 font-extrabold text-black disabled:opacity-50 active:scale-95"
              >
                {opening ? "Opening..." : ad.placement === "club_song" ? "Listen" : "Find out more"}
              </button>
              <p className="mt-2 text-center text-[11px] text-zinc-500">Opens a website outside Campus Life.</p>
            </>
          ) : null}
          <button type="button" onClick={onClose} className="mt-3 w-full py-2 text-sm text-zinc-400">
            Back to the game
          </button>
        </div>
      </div>
    </div>
  );
}
