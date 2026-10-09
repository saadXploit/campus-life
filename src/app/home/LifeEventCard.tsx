"use client";

import { motion } from "framer-motion";
import { choiceEffects, type LifeEvent } from "@/lib/game/life";
import { formatNaira } from "@/lib/money";

/** Naija life happens: a short story with a choice. Afterwards it shows what happened. */
export default function LifeEventCard({
  event,
  balance,
  result,
  pending,
  onChoose,
  onDone,
}: {
  event: LifeEvent;
  balance: number;
  /** What happened after choosing (null while still deciding). */
  result: string | null;
  pending: boolean;
  onChoose: (key: string) => void;
  onDone: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-5">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-3xl border border-amber-400/30 bg-[#10172e] p-5 text-center"
      >
        <p className="text-5xl">{event.emoji}</p>
        <p className="mt-2 text-xs font-semibold tracking-[0.2em] text-amber-300">NAIJA LIFE</p>
        <p className="text-xl font-extrabold">{event.title}</p>
        <p className="mt-2 text-sm text-zinc-300">{event.body}</p>

        {result ? (
          <>
            <p className="mt-4 rounded-2xl bg-white/5 p-3 text-sm italic text-zinc-100">{result}</p>
            <button type="button" onClick={onDone} className="mt-4 w-full rounded-xl bg-amber-400 py-2.5 font-bold text-black">
              OK
            </button>
          </>
        ) : (
          <div className="mt-4 space-y-2">
            {event.choices.map((c) => {
              const cantAfford = (c.money ?? 0) < 0 && balance < -(c.money ?? 0);
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => onChoose(c.key)}
                  disabled={pending || cantAfford}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-3 text-left transition hover:bg-white/10 disabled:opacity-40"
                >
                  <span className="block text-sm font-bold">{c.label}</span>
                  <span className="block text-[11px] text-zinc-400">
                    {cantAfford ? "You can't afford this right now" : choiceEffects(c, formatNaira) || "No change"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
