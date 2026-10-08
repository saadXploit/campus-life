"use client";

import { useState, useTransition } from "react";
import { billLabel, unpaid, type Bills } from "@/lib/game/bills";
import type { GameDynamic } from "@/lib/game/gameTypes";
import { formatDuration, lagosDateLabel } from "@/lib/game/time";
import { formatNaira } from "@/lib/money";
import { chooseRoomAction, payBillAction } from "./bill-actions";

/** School fees, rent and choosing where you live. */
export default function FeesPanel({
  bills,
  balance,
  nowMs,
  onBills,
  onDynamic,
  onClose,
}: {
  bills: Bills | null;
  balance: number;
  nowMs: number;
  onBills: (b: Bills) => void;
  onDynamic: (d: GameDynamic) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const owing = unpaid(bills);
  const roomName = (slug: string | null) => bills?.rooms.find((r) => r.slug === slug)?.name ?? "Shared hostel";

  function pay(id: number) {
    setError(null);
    setBusy(`bill:${id}`);
    startTransition(async () => {
      const r = await payBillAction(id);
      setBusy(null);
      if (!r.data) {
        setError(r.error ?? "Payment failed.");
        return;
      }
      onBills(r.data);
      onDynamic(r.data);
    });
  }

  function choose(slug: string) {
    setError(null);
    setBusy(`room:${slug}`);
    startTransition(async () => {
      const r = await chooseRoomAction(slug);
      setBusy(null);
      if (!r.data) {
        setError(r.error ?? "That did not work.");
        return;
      }
      onBills(r.data);
    });
  }

  const rentPaidThisSemester = bills?.bills.some(
    (b) => b.kind === "rent" && b.semester_idx === bills.semester_idx && b.paid_at
  );

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#10172e] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-amber-300">FEES AND RENT</p>
            <p className="text-xl font-extrabold">This semester</p>
            <p className="text-sm text-zinc-400">Wallet: {formatNaira(balance)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl text-zinc-400">
            ✕
          </button>
        </div>

        {error && <p className="mt-3 rounded-xl bg-red-500/15 p-2 text-sm text-red-200">{error}</p>}

        {!bills ? (
          <p className="mt-6 text-center text-sm text-zinc-400">Loading...</p>
        ) : bills.covered_by_admission ? (
          <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4 text-sm">
            <p className="font-bold text-emerald-200">✅ Covered by your admission</p>
            <p className="mt-1 text-zinc-300">
              Your fees and rent for this first semester are already paid. Next semester&apos;s bills arrive{" "}
              {lagosDateLabel(Date.parse(bills.next_bills_at))}. Save up: work shifts to earn.
            </p>
          </div>
        ) : owing.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4 text-sm">
            <p className="font-bold text-emerald-200">✅ All paid for this semester</p>
            <p className="mt-1 text-zinc-300">Next bills arrive {lagosDateLabel(Date.parse(bills.next_bills_at))}.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {owing.map(({ bill, total }) => {
              const due = Date.parse(bill.due_at);
              const late = due < nowMs;
              return (
                <div
                  key={bill.id}
                  className={
                    "rounded-2xl border p-4 " + (late ? "border-red-400/40 bg-red-500/10" : "border-white/10 bg-white/5")
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">
                        {bill.kind === "tuition" ? "🎓" : "🛏️"} {billLabel(bill.kind)}
                        {bill.kind === "rent" && (
                          <span className="ml-1 text-xs font-normal text-zinc-400">· {roomName(bill.accommodation)}</span>
                        )}
                      </p>
                      <p className={"text-xs " + (late ? "text-red-200" : "text-zinc-400")}>
                        {late ? `Overdue · late fee ${formatNaira(Number(bill.late_fee_kobo))}` : `Due in ${formatDuration(due - nowMs)}`}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {bill.kind === "tuition"
                          ? "Unpaid school fees block your exams."
                          : "Unpaid rent after the due date: half energy from sleep."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => pay(bill.id)}
                      disabled={busy !== null || balance < total}
                      className="shrink-0 rounded-xl bg-amber-400 px-3 py-2 text-sm font-extrabold text-black disabled:opacity-40"
                    >
                      {busy === `bill:${bill.id}` ? "Paying..." : `Pay ${formatNaira(total)}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {bills && (
          <>
            <p className="mt-6 text-xs font-semibold tracking-[0.15em] text-zinc-400">WHERE YOU LIVE</p>
            <p className="mt-1 text-xs text-zinc-500">
              Living in: <span className="font-semibold text-zinc-300">{roomName(bills.living_in)}</span>.{" "}
              {rentPaidThisSemester
                ? "This semester's rent is paid, so a new choice starts next semester."
                : "Changing now updates this semester's rent bill."}
            </p>
            <div className="mt-2 space-y-2">
              {bills.rooms.map((r) => {
                const picked = bills.chosen === r.slug;
                return (
                  <button
                    key={r.slug}
                    type="button"
                    onClick={() => !picked && choose(r.slug)}
                    disabled={busy !== null}
                    className={
                      "w-full rounded-2xl border p-3 text-left transition disabled:opacity-60 " +
                      (picked ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/5 hover:bg-white/10")
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold">
                        {picked ? "✓ " : ""}
                        {r.name}
                      </p>
                      <p className="text-sm font-extrabold text-emerald-300">{formatNaira(Number(r.rent_kobo))}</p>
                    </div>
                    <p className="text-xs text-zinc-400">{r.description}</p>
                    <p className="mt-1 text-[11px] text-zinc-300">
                      {r.sleep_bonus > 0 ? `😴 +${r.sleep_bonus}% energy from sleep` : "😴 Normal sleep"} · per semester
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
