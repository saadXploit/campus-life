"use client";

import { useEffect, useState } from "react";
import { openNotificationsAction, type GameNotification } from "./wallet-actions";

const ICONS: Record<string, string> = {
  transfer_received: "💸",
  admin_adjustment: "🏛️",
  fight: "👊",
};

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationsPanel({
  onClose,
  onOpened,
}: {
  onClose: () => void;
  onOpened: () => void;
}) {
  const [items, setItems] = useState<GameNotification[] | null>(null);

  useEffect(() => {
    let live = true;
    openNotificationsAction().then((n) => {
      if (!live) return;
      setItems(n);
      onOpened();
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#10172e] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-lg font-extrabold">Notifications</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl text-zinc-400">
            ✕
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {items === null && <p className="text-sm text-zinc-400">Loading...</p>}
          {items?.length === 0 && <p className="text-sm text-zinc-400">Nothing yet. Go live your campus life.</p>}
          {items?.map((n) => (
            <div
              key={n.id}
              className={
                "flex gap-3 rounded-xl px-4 py-3 " + (n.read_at ? "bg-white/5" : "border border-amber-400/40 bg-amber-400/10")
              }
            >
              <span className="text-xl">{ICONS[n.kind] ?? "🔔"}</span>
              <div>
                <p className="text-sm font-semibold">{n.title}</p>
                {n.body && <p className="text-sm text-zinc-400">“{n.body}”</p>}
                <p className="mt-1 text-xs text-zinc-500">{timeAgo(n.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
