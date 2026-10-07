"use client";

import { useState } from "react";
import {
  gradeColor,
  nextLectureStart,
  phaseLabel,
  semesterName,
  slotLabel,
  type Academics,
} from "@/lib/game/academics";
import { formatDuration, lagosDateLabel } from "@/lib/game/time";

const TYPE_NOTE: Record<string, string> = {
  federal: "Federal university · low fees · lecturers can go on strike",
  state: "State university · moderate fees",
  private: "Private university · small classes · curfew after 11 PM (gate fine)",
};

export default function AcademicsPanel({
  academics,
  nowMs,
  onClose,
}: {
  academics: Academics | null;
  nowMs: number;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"semester" | "results">("semester");
  const a = academics;
  const c = a?.calendar;
  const phaseEnd = c
    ? Date.parse(c.phase === "lectures" ? c.lectures_end : c.phase === "exams" ? c.exams_end : c.holiday_end)
    : 0;

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#10172e] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-amber-300">ACADEMICS</p>
            {a && c ? (
              <>
                <p className="text-xl font-extrabold">
                  {c.session} · {semesterName(c.semester_no)}
                </p>
                <p className="text-sm text-zinc-400">
                  {phaseLabel(a)}
                  {phaseEnd > nowMs && ` · ends in ${formatDuration(phaseEnd - nowMs)}`}
                </p>
              </>
            ) : (
              <p className="text-xl font-extrabold">Loading...</p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl text-zinc-400">
            ✕
          </button>
        </div>

        {a && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/5 p-2">
              <p className="text-[10px] text-zinc-500">LEVEL</p>
              <p className="font-extrabold">{a.status === "graduated" ? "🎓" : `${a.level_year}00L`}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-2">
              <p className="text-[10px] text-zinc-500">CGPA</p>
              <p className="font-extrabold">{a.cgpa !== null ? Number(a.cgpa).toFixed(2) : "—"}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-2">
              <p className="text-[10px] text-zinc-500">UNITS DONE</p>
              <p className="font-extrabold">{a.total_units}</p>
            </div>
          </div>
        )}
        {a?.uni_type && <p className="mt-2 text-center text-[11px] text-zinc-500">{TYPE_NOTE[a.uni_type]}</p>}

        {a?.strike && (
          <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            ✊ {a.strike}. Lectures are suspended; missed lectures do not count against you.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1 text-sm font-semibold">
          {(["semester", "results"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={"rounded-lg py-2 " + (tab === t ? "bg-white/15" : "text-zinc-400")}
            >
              {t === "semester" ? "This semester" : "Results"}
            </button>
          ))}
        </div>

        {tab === "semester" && a && (
          <div className="mt-4 space-y-3">
            {!a.registered && (
              <p className="rounded-xl bg-white/5 p-3 text-sm text-zinc-300">
                {c?.phase === "lectures"
                  ? "You will be registered for this semester the next time you play. Attendance only counts from the day you join."
                  : c
                    ? `You joined after this semester's lectures ended. Your first lectures start on ${lagosDateLabel(Date.parse(c.holiday_end))}. Until then, explore campus, make friends and get ready.`
                    : null}
              </p>
            )}
            {a.modules.map((m) => {
              const next = nextLectureStart(m.slots, nowMs);
              const live = m.live_lecture !== null;
              return (
                <div key={m.code} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">
                        {m.code} <span className="text-xs font-normal text-zinc-400">· {m.units} units</span>
                      </p>
                      <p className="text-sm text-zinc-300">{m.title}</p>
                    </div>
                    {live && !m.attended_live && c?.phase === "lectures" && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        LIVE NOW
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    🗓 {m.slots.map((s) => slotLabel(s)).join(" · ")}
                    {c?.phase === "lectures" && next && !live && ` · next in ${formatDuration(next - nowMs)}`}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <p className="text-zinc-500">Attendance</p>
                      <p className="font-bold">
                        {m.attended}/{m.held}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Study</p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full bg-sky-400" style={{ width: `${m.study_points * 10}%` }} />
                      </div>
                    </div>
                    <div>
                      <p className="text-zinc-500">Exam</p>
                      <p className="font-bold">{m.exam_written ? "✅ Written" : c?.phase === "exams" ? "⏳ Due" : "—"}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-zinc-500">
              Lectures happen at the Faculty Block (you can join up to 2 hours after they start). Study at the
              library or your hostel desk. Exams are written at the Faculty Block in exam week. Score = CA (attendance
              + study, /30) + exam (/70). How tired or sick you are when you write affects the exam.
            </p>
          </div>
        )}

        {tab === "results" && a && (
          <div className="mt-4 space-y-3">
            {a.results.length === 0 && (
              <p className="rounded-xl bg-white/5 p-3 text-sm text-zinc-400">
                No results yet. Results come out when exam week ends.
              </p>
            )}
            {a.results.map((r) => (
              <div key={r.semester_idx} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold">
                    {r.level_year}00L · {semesterName(r.semester_no)}
                  </p>
                  <p className="text-sm">
                    GPA <span className="font-extrabold">{r.gpa !== null ? Number(r.gpa).toFixed(2) : "—"}</span>
                  </p>
                </div>
                <div className="mt-2 space-y-1">
                  {(r.modules ?? []).map((m) => (
                    <div key={m.code} className="flex items-center justify-between text-xs">
                      <span className="truncate text-zinc-300">
                        {m.code} · {m.title}
                      </span>
                      <span className="ml-2 shrink-0 tabular-nums text-zinc-400">
                        {m.ca}+{m.exam}={m.score}{" "}
                        <span className="font-extrabold" style={{ color: gradeColor(m.grade) }}>
                          {m.grade}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
