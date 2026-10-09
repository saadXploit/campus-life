"use client";

import { motion } from "framer-motion";
import { formatClock } from "@/lib/game/time";
import { formatNaira } from "@/lib/money";

export type PhoneApp = "chats" | "friends" | "dating" | "shop" | "academics" | "bank" | "fees" | "jobs" | "alerts";

type AppTile = { id: PhoneApp; label: string; icon: string; color: string; badge?: number };

/** One app icon on the phone. */
function Tile({ app, small = false, onOpen }: { app: AppTile; small?: boolean; onOpen: (app: PhoneApp) => void }) {
  return (
    <button type="button" onClick={() => onOpen(app.id)} className="flex flex-col items-center gap-1 active:scale-90">
      <span
        className={"relative flex items-center justify-center rounded-2xl shadow-lg " + (small ? "h-12 w-12 text-2xl" : "h-14 w-14 text-3xl")}
        style={{ background: `linear-gradient(145deg, ${app.color}, ${app.color}cc)` }}
      >
        {app.icon}
        {!!app.badge && app.badge > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-black/40">
            {app.badge > 9 ? "9+" : app.badge}
          </span>
        )}
      </span>
      {!small && <span className="text-[11px] font-semibold text-white drop-shadow">{app.label}</span>}
    </button>
  );
}


/**
 * The student's phone: chats, friends, dating, shopping, academics, money and more,
 * all in one place. Tapping an app opens it; closing the app comes back here.
 */
export default function Phone({
  name,
  hour,
  dateLabel,
  balance,
  primary,
  secondary,
  badges,
  onOpen,
  onClose,
}: {
  name: string;
  hour: number;
  dateLabel: string;
  balance: number;
  primary: string;
  secondary: string;
  badges: { chats: number; friends: number; dating: number; alerts: number; fees: number };
  onOpen: (app: PhoneApp) => void;
  onClose: () => void;
}) {
  const apps: AppTile[] = [
    { id: "chats", label: "Chats", icon: "💬", color: "#16a34a", badge: badges.chats },
    { id: "friends", label: "Friends", icon: "👥", color: "#2563eb", badge: badges.friends },
    { id: "dating", label: "Dating", icon: "💘", color: "#db2777", badge: badges.dating },
    { id: "shop", label: "Shop", icon: "🛍️", color: "#f59e0b" },
    { id: "academics", label: "Academics", icon: "📚", color: "#0ea5e9" },
    { id: "bank", label: "Bank", icon: "🏦", color: "#059669" },
    { id: "fees", label: "Fees", icon: "🧾", color: "#dc2626", badge: badges.fees },
    { id: "jobs", label: "Jobs", icon: "💼", color: "#7c3aed" },
    { id: "alerts", label: "Alerts", icon: "🔔", color: "#475569", badge: badges.alerts },
  ];
  const dock = apps.filter((a) => a.id === "chats" || a.id === "friends" || a.id === "shop");

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-[min(640px,88dvh)] w-[min(320px,92vw)] flex-col overflow-hidden rounded-[2.6rem] border-[10px] border-[#0a0a0a] shadow-2xl ring-1 ring-white/15"
        style={{ background: `radial-gradient(circle at 20% 10%, ${secondary}55, transparent 45%), linear-gradient(160deg, ${primary}, #0b1020 75%)` }}
      >
        {/* status bar and notch */}
        <div className="relative flex items-center justify-between px-5 pt-2 text-[11px] font-semibold text-white">
          <span className="tabular-nums">{formatClock(hour)}</span>
          <span className="absolute left-1/2 top-1.5 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
          <span>📶 🔋</span>
        </div>

        <div className="mt-6 px-5 text-white">
          <p className="text-4xl font-black tabular-nums drop-shadow">{formatClock(hour)}</p>
          <p className="text-xs text-white/80">{dateLabel} · WAT</p>
          <p className="mt-3 text-sm font-semibold">Hi, {name} 👋</p>
          <p className="text-xs text-emerald-200">Balance {formatNaira(balance)}</p>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-y-5 px-4">
          {apps.map((a) => (
            <Tile key={a.id} app={a} onOpen={onOpen} />
          ))}
        </div>

        {/* dock and home bar */}
        <div className="mt-auto px-4 pb-2">
          <div className="flex justify-around rounded-3xl bg-white/15 py-2.5 backdrop-blur">
            {dock.map((a) => (
              <Tile key={a.id} app={a} small onOpen={onOpen} />
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Close phone" className="mx-auto mt-2 block h-1.5 w-28 rounded-full bg-white/70" />
        </div>
      </motion.div>
    </div>
  );
}
