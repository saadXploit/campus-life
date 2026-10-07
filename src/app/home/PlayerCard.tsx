"use client";

import { useState } from "react";
import type { GameInteraction, Person } from "@/lib/game/gameTypes";
import { REPORT_REASONS, bondLabel } from "@/lib/game/social";
import { formatNaira } from "@/lib/money";

export default function PlayerCard({
  person,
  placeName,
  interactions,
  blockedReason,
  pendingKind,
  canReportMessage,
  onInteract,
  onBlock,
  onReport,
  onClose,
}: {
  person: Person;
  placeName: string | null;
  /** Only the interactions allowed where you both are. */
  interactions: GameInteraction[];
  /** Why nothing can be done right now (asleep, busy...), or null. */
  blockedReason: string | null;
  pendingKind: string | null;
  canReportMessage: boolean;
  onInteract: (kind: string) => void;
  onBlock: () => void;
  onReport: (reason: string, details: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"main" | "report" | "reported">("main");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const bondPct = (person.bond + 100) / 2;
  const together = person.location_kind && placeName;

  async function submitReport() {
    if (!reason) return setError("Please pick a reason.");
    setSending(true);
    const err = await onReport(reason, details);
    setSending(false);
    if (err) return setError(err);
    setMode("reported");
  }

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#10172e] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-extrabold">{person.name}</p>
            <p className="text-sm text-zinc-400">
              {person.asleep ? "😴 Asleep" : together ? `At the same place as you` : "Somewhere on campus"}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl text-zinc-400">
            ✕
          </button>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Your bond</span>
            <span className={person.bond < 0 ? "font-bold text-red-300" : "font-bold text-emerald-300"}>
              {bondLabel(person.bond)} ({person.bond > 0 ? "+" : ""}
              {person.bond})
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className={"h-full rounded-full " + (person.bond < 0 ? "bg-red-400" : "bg-emerald-400")}
              style={{ width: `${bondPct}%` }}
            />
          </div>
        </div>

        {mode === "main" && (
          <>
            {blockedReason ? (
              <p className="mt-4 rounded-xl bg-white/5 p-3 text-center text-sm text-zinc-300">{blockedReason}</p>
            ) : interactions.length === 0 ? (
              <p className="mt-4 rounded-xl bg-white/5 p-3 text-center text-sm text-zinc-300">
                Nothing to do together here.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {interactions.map((i) => (
                  <button
                    key={i.slug}
                    type="button"
                    onClick={() => onInteract(i.slug)}
                    disabled={pendingKind !== null}
                    className={
                      "rounded-2xl border p-3 text-left transition disabled:opacity-40 active:scale-95 " +
                      (i.bond_delta < 0
                        ? "border-red-500/40 bg-red-500/10 hover:bg-red-500/20"
                        : "border-white/10 bg-white/5 hover:bg-white/10")
                    }
                  >
                    <p className="font-bold">
                      {i.emoji} {pendingKind === i.slug ? "..." : i.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      {i.energy_cost > 0 && `⚡-${i.energy_cost} `}
                      {i.cost_kobo > 0 && formatNaira(i.cost_kobo)}
                      {i.bond_delta < 0 && " · ruins your bond"}
                    </p>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-5 flex gap-2 text-sm">
              <button
                type="button"
                onClick={onBlock}
                className="flex-1 rounded-xl border border-white/15 py-2 text-zinc-300 hover:bg-white/10"
              >
                🚫 Block
              </button>
              <button
                type="button"
                onClick={() => setMode("report")}
                className="flex-1 rounded-xl border border-white/15 py-2 text-zinc-300 hover:bg-white/10"
              >
                🚩 Report
              </button>
            </div>
          </>
        )}

        {mode === "report" && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-zinc-300">Why are you reporting {person.name}?</p>
            {REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className={
                  "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm " +
                  (reason === r.value ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/5")
                }
              >
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                />
                {r.label}
              </label>
            ))}
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="What happened? (optional)"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-amber-400"
            />
            {canReportMessage && (
              <p className="text-xs text-zinc-500">Their latest message here will be attached as evidence.</p>
            )}
            {error && <p className="text-sm text-red-300">{error}</p>}
            <button
              type="button"
              onClick={submitReport}
              disabled={sending}
              className="w-full rounded-2xl bg-red-500 py-3 font-bold disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send report"}
            </button>
            <button type="button" onClick={() => setMode("main")} className="w-full py-2 text-sm text-zinc-400">
              Back
            </button>
          </div>
        )}

        {mode === "reported" && (
          <div className="mt-5 text-center">
            <p className="text-4xl">🛡️</p>
            <p className="mt-2 font-bold">Thanks. Our moderators will look at it.</p>
            <p className="mt-1 text-sm text-zinc-400">You can also block {person.name} so you stop seeing each other.</p>
            <button
              type="button"
              onClick={onBlock}
              className="mt-4 w-full rounded-2xl border border-white/15 py-3 text-sm font-semibold hover:bg-white/10"
            >
              🚫 Block {person.name}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
