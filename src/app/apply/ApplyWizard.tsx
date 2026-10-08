"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import UniversityCrest from "@/components/UniversityCrest";
import { formatNaira } from "@/lib/money";
import { submitApplicationAction } from "./actions";
import { Backdrop, JourneyHeader } from "@/components/journey/Journey";

type Catalog = {
  faculty: string;
  courses: { code: string; name: string; duration_years: number }[];
}[];

type UniOption = {
  id: string;
  name: string;
  short_name: string;
  type: string;
  primary_color: string;
  secondary_color: string;
  tuition_per_semester_kobo: number;
  difficulty: number;
};

const STEPS = ["Course", "Universities", "Review"];

function hint(difficulty: number): string {
  if (difficulty >= 8) return "Very competitive";
  if (difficulty >= 6) return "Competitive";
  return "More open";
}

export default function ApplyWizard({
  catalog,
  universities,
  recommendedFaculty,
}: {
  catalog: Catalog;
  universities: UniOption[];
  recommendedFaculty: string | null;
}) {
  const [state, formAction, pending] = useActionState(submitApplicationAction, null);
  const [step, setStep] = useState(0);
  const [courseCode, setCourseCode] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const sorted = [...catalog].sort((a, b) => {
    if (a.faculty === recommendedFaculty) return -1;
    if (b.faculty === recommendedFaculty) return 1;
    return a.faculty.localeCompare(b.faculty);
  });

  const course = catalog.flatMap((f) => f.courses).find((c) => c.code === courseCode);

  function toggle(id: string) {
    setMessage(null);
    setPicked((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id);
      if (current.length >= 3) return current;
      return [...current, id];
    });
  }

  function next() {
    if (step === 0 && !courseCode) {
      setMessage("Pick the course you want to study.");
      return;
    }
    if (step === 1 && picked.length === 0) {
      setMessage("Pick at least one university.");
      return;
    }
    setMessage(null);
    setStep((s) => Math.min(2, s + 1));
  }

  return (
    <main className="relative isolate min-h-screen px-4 pb-32 pt-6 text-white">
      <Backdrop />
      <div className="mx-auto max-w-4xl">
        <JourneyHeader step="apply" back={{ href: "/universities", label: "Universities" }} />
      </div>
      <div className="mx-auto max-w-md">
        <div className="flex flex-wrap gap-1.5">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={
                "rounded-full px-3 py-1 text-[11px] font-semibold " +
                (i === step
                  ? "bg-amber-400 text-black"
                  : i < step
                    ? "bg-emerald-400/15 text-emerald-300"
                    : "bg-white/5 text-zinc-500")
              }
            >
              {i < step ? "✓ " : ""}
              {label}
            </span>
          ))}
        </div>

        <form action={formAction}>
          <input type="hidden" name="courseCode" value={courseCode} />
          {picked.map((id) => (
            <input key={id} type="hidden" name="university" value={id} />
          ))}

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="mt-6"
            >
              {step === 0 && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-2xl font-extrabold">What will you study?</h1>
                    <p className="mt-1 text-sm text-zinc-400">
                      Every university offers every course, but each has its own entry
                      standard.
                    </p>
                  </div>
                  {sorted.map((f) => (
                    <div key={f.faculty}>
                      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-300">
                        {f.faculty}
                        {f.faculty === recommendedFaculty && (
                          <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            MATCHES YOUR INTEREST
                          </span>
                        )}
                      </p>
                      <div className="space-y-2">
                        {f.courses.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              setCourseCode(c.code);
                              setMessage(null);
                            }}
                            className={
                              "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition active:scale-[0.98] " +
                              (courseCode === c.code
                                ? "border-amber-400 bg-amber-400/10"
                                : "border-white/10 bg-white/5")
                            }
                          >
                            <span>{c.name}</span>
                            <span className="text-xs text-zinc-500">{c.duration_years} yrs</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-2xl font-extrabold">Rank your universities</h1>
                    <p className="mt-1 text-sm text-zinc-400">
                      Tap up to three, in the order you prefer. If you do not make your
                      first choice, the next one gets a look.
                    </p>
                  </div>
                  {universities.map((u) => {
                    const rank = picked.indexOf(u.id) + 1;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggle(u.id)}
                        className={
                          "relative flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition active:scale-[0.98] " +
                          (rank ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/5")
                        }
                      >
                        <UniversityCrest
                          shortName={u.short_name}
                          primary={u.primary_color}
                          secondary={u.secondary_color}
                          className="h-14 w-12 shrink-0"
                        />
                        <div className="flex-1">
                          <p className="font-bold leading-tight">{u.name}</p>
                          <p className="mt-1 text-xs text-zinc-400">
                            {formatNaira(u.tuition_per_semester_kobo)} per semester ·{" "}
                            {hint(u.difficulty)}
                          </p>
                        </div>
                        {rank > 0 && (
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-black">
                            {rank}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <h1 className="text-2xl font-extrabold">Ready to apply?</h1>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-zinc-500">Course</p>
                    <p className="mt-1 font-bold">{course?.name}</p>
                  </div>
                  <div className="space-y-2">
                    {picked.map((id, i) => {
                      const u = universities.find((x) => x.id === id);
                      if (!u) return null;
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-black">
                            {i + 1}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-bold">{u.name}</p>
                            <p className="text-xs text-zinc-400">
                              {formatNaira(u.tuition_per_semester_kobo)} per semester
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-sm text-zinc-400">
                    After you submit, an entrance examination of 10 questions will be
                    scheduled. Your result depends on your exam score and each
                    university&apos;s standard.
                  </p>
                  {state?.error && (
                    <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                      {state.error}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {message && <p className="mt-4 text-sm text-amber-300">{message}</p>}

          <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#0b1020]/95 px-4 py-4 backdrop-blur">
            <div className="mx-auto flex max-w-md gap-3">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMessage(null);
                    setStep((s) => Math.max(0, s - 1));
                  }}
                  className="rounded-2xl border border-white/20 px-5 py-4 text-sm font-semibold text-zinc-300"
                >
                  Back
                </button>
              )}
              {step < 2 ? (
                <button
                  type="button"
                  onClick={next}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-4 text-base font-extrabold text-black active:scale-95"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-4 text-base font-extrabold text-black disabled:opacity-60 active:scale-95"
                >
                  {pending ? "Submitting..." : "Submit application"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}