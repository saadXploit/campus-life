"use client";

import { useState } from "react";
import {
  RANK_NAMES,
  hoursLabel,
  jobOpen,
  nextRaise,
  notEligible,
  requirementText,
  type GameJob,
  type PlayerJob,
} from "@/lib/game/jobs";
import { formatDuration } from "@/lib/game/time";
import { formatNaira } from "@/lib/money";

export default function JobsPanel({
  jobs,
  job,
  hour,
  nowMs,
  me,
  hereKind,
  placeName,
  occupied,
  pending,
  onApply,
  onQuit,
  onStartShift,
  onClose,
}: {
  jobs: GameJob[];
  job: PlayerJob | null;
  hour: number;
  nowMs: number;
  me: { level: number; cgpa: number | null; age: number | null };
  /** Where the server says you are. */
  hereKind: string | null;
  placeName: (kind: string) => string;
  occupied: boolean;
  pending: boolean;
  onApply: (slug: string) => void;
  onQuit: () => void;
  onStartShift: () => void;
  onClose: () => void;
}) {
  const [confirmQuit, setConfirmQuit] = useState(false);
  const mine = job?.slug ? (jobs.find((j) => j.slug === job.slug) ?? null) : null;
  const changeAt = job ? Date.parse(job.can_change_at) : 0;
  const mustWait = job && !job.slug && changeAt > nowMs ? changeAt - nowMs : 0;

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#10172e] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-amber-300">JOBS</p>
            <p className="text-xl font-extrabold">{mine ? mine.name : "Find a job"}</p>
            <p className="text-sm text-zinc-400">
              One job at a time. Go to the workplace, meet the boss and work real-time shifts.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl text-zinc-400">
            ✕
          </button>
        </div>

        {mine && job && (
          <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold tracking-[0.15em] text-emerald-300">
                  YOUR JOB · {RANK_NAMES[job.rank]?.toUpperCase()}
                </p>
                <p className="text-lg font-extrabold">{mine.name}</p>
                <p className="text-xs text-zinc-400">
                  Boss: {mine.boss_name}, {mine.boss_title} · {placeName(mine.location_kind)}
                </p>
              </div>
              <p className="text-right text-lg font-black text-emerald-300">
                {formatNaira(job.pay_kobo ?? mine.pay_kobo)}
                <span className="block text-[11px] font-normal text-zinc-400">per shift</span>
              </p>
            </div>
            <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-zinc-300">
              <span>⏱ {formatDuration(mine.shift_minutes * 60_000)}</span>
              <span>⚡ -{mine.energy_cost}</span>
              <span>🕘 {hoursLabel(mine.open_hour, mine.close_hour)}</span>
              <span>
                📅 {job.shifts_today}/{job.daily_limit} shifts today
              </span>
              <span>✅ {job.shifts_done} shifts worked</span>
            </p>
            {nextRaise(job.shifts_done) && (
              <p className="mt-1 text-xs text-amber-300">
                {nextRaise(job.shifts_done)!.at - job.shifts_done} more shifts to become{" "}
                {nextRaise(job.shifts_done)!.name}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              {hereKind !== mine.location_kind ? (
                <p className="flex-1 rounded-xl bg-white/5 px-3 py-2 text-center text-sm text-zinc-300">
                  Go to {placeName(mine.location_kind)} to start a shift
                </p>
              ) : !jobOpen(mine.open_hour, mine.close_hour, hour) ? (
                <p className="flex-1 rounded-xl bg-white/5 px-3 py-2 text-center text-sm text-zinc-300">
                  Closed now. Open {hoursLabel(mine.open_hour, mine.close_hour)}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={onStartShift}
                  disabled={occupied || pending || job.shifts_today >= job.daily_limit}
                  className="flex-1 rounded-xl bg-emerald-400 px-3 py-2 text-sm font-extrabold text-black disabled:opacity-40"
                >
                  {job.shifts_today >= job.daily_limit ? "Enough shifts today" : "💼 Start shift"}
                </button>
              )}
              <button
                type="button"
                onClick={() => (confirmQuit ? onQuit() : setConfirmQuit(true))}
                disabled={occupied || pending}
                className="rounded-xl border border-red-400/40 px-3 py-2 text-sm text-red-200 disabled:opacity-40"
              >
                {confirmQuit ? "Tap again to quit" : "Quit"}
              </button>
            </div>
            {confirmQuit && (
              <p className="mt-2 text-[11px] text-zinc-400">
                Quitting resets your rank, and you must wait a day before taking another job.
              </p>
            )}
          </div>
        )}

        {mustWait > 0 && (
          <p className="mt-4 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-200">
            You can take a new job in {formatDuration(mustWait)}.
          </p>
        )}

        <div className="mt-4 space-y-2">
          {jobs
            .filter((j) => j.slug !== mine?.slug)
            .map((j) => {
              const open = jobOpen(j.open_hour, j.close_hour, hour);
              const req = requirementText(j);
              const why = notEligible(j, me);
              const there = hereKind === j.location_kind;
              return (
                <div key={j.slug} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold">{j.name}</p>
                      <p className="text-xs text-zinc-400">{j.description}</p>
                    </div>
                    <p className="shrink-0 text-right font-extrabold text-emerald-300">
                      {formatNaira(j.pay_kobo)}
                      <span className="block text-[10px] font-normal text-zinc-400">per shift</span>
                    </p>
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-zinc-300">
                    <span>📍 {placeName(j.location_kind)}</span>
                    <span>
                      🕘 {hoursLabel(j.open_hour, j.close_hour)} {open ? "· open now" : "· closed"}
                    </span>
                    <span>⏱ {formatDuration(j.shift_minutes * 60_000)}</span>
                    <span>⚡ -{j.energy_cost}</span>
                    {req && <span className="text-amber-300">{req}</span>}
                  </p>
                  <p className="mt-1 text-[11px] text-sky-300">
                    Boss: {j.boss_name}, {j.boss_title}
                  </p>
                  <div className="mt-2">
                    {why ? (
                      <p className="text-xs text-zinc-500">{why}</p>
                    ) : mine ? (
                      <p className="text-xs text-zinc-500">Quit your current job first to take this one.</p>
                    ) : mustWait > 0 ? null : !there ? (
                      <p className="text-xs text-zinc-400">
                        Go to {placeName(j.location_kind)} to meet {j.boss_name}.
                      </p>
                    ) : !open ? (
                      <p className="text-xs text-zinc-400">
                        {j.boss_name} is not in. Come back {hoursLabel(j.open_hour, j.close_hour)}.
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onApply(j.slug)}
                        disabled={pending}
                        className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-40"
                      >
                        Ask {j.boss_name} for the job
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        <p className="mt-4 text-[11px] text-zinc-500">
          You are paid for every finished shift, even if you close the game while working. Work 10
          shifts for a raise and 30 for Senior pay. Bosses and campus staff are part of the game, not real players.
        </p>
      </div>
    </div>
  );
}
