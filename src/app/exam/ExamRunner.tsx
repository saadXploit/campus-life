"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ExamQuestion } from "@/lib/game/exam";
import { finishExamAction, saveAnswerAction } from "./actions";

const LETTERS = ["A", "B", "C", "D"];

export default function ExamRunner({
  attemptId,
  expiresAt,
  questions,
}: {
  attemptId: string;
  expiresAt: string;
  questions: ExamQuestion[];
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>(() => {
    const start: Record<number, number> = {};
    for (const q of questions) if (q.chosen !== null) start[q.position] = q.chosen;
    return start;
  });
  const [left, setLeft] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const finishing = useRef(false);

  function finish() {
    if (finishing.current) return;
    finishing.current = true;
    startTransition(() => {
      void finishExamAction(attemptId);
    });
  }

  useEffect(() => {
    const end = new Date(expiresAt).getTime();
    const tick = () => {
      const seconds = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(seconds);
      if (seconds === 0 && !finishing.current) {
        finishing.current = true;
        startTransition(() => {
          void finishExamAction(attemptId);
        });
      }
    };
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [expiresAt, attemptId]);

  const q = questions[index];
  const answered = Object.keys(answers).length;
  const last = index === questions.length - 1;

  function choose(option: number) {
    setAnswers((current) => ({ ...current, [q.position]: option }));
    startTransition(() => {
      void saveAnswerAction(attemptId, q.position, option);
    });
  }

  function confirmFinish() {
    const missing = questions.length - answered;
    if (missing > 0 && !window.confirm(`${missing} question(s) are unanswered. Submit anyway?`)) {
      return;
    }
    finish();
  }

  const minutes = left === null ? 0 : Math.floor(left / 60);
  const seconds = left === null ? 0 : left % 60;

  return (
    <main className="min-h-screen bg-[#0b1020] px-4 pb-32 pt-5 text-white">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-[0.3em] text-amber-400">ENTRANCE EXAM</p>
          <p
            className={
              "rounded-full px-3 py-1 text-sm font-bold tabular-nums " +
              (left !== null && left <= 60
                ? "bg-red-500/20 text-red-300"
                : "bg-white/10 text-white")
            }
          >
            {left === null ? "..." : `${minutes}:${String(seconds).padStart(2, "0")}`}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {questions.map((item, i) => (
            <button
              key={item.position}
              type="button"
              onClick={() => setIndex(i)}
              className={
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold " +
                (i === index
                  ? "bg-amber-400 text-black"
                  : answers[item.position] !== undefined
                    ? "bg-emerald-500/30 text-emerald-200"
                    : "bg-white/10 text-zinc-400")
              }
            >
              {i + 1}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={q.position}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18 }}
            className="mt-6"
          >
            <p className="text-xs text-zinc-500">
              Question {index + 1} of {questions.length}
            </p>
            <h1 className="mt-2 text-xl font-bold leading-snug">{q.prompt}</h1>

            <div className="mt-5 space-y-3">
              {q.options.map((text, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => choose(i)}
                  className={
                    "flex w-full items-center gap-3 rounded-2xl border p-4 text-left text-sm transition active:scale-[0.98] " +
                    (answers[q.position] === i
                      ? "border-amber-400 bg-amber-400/10"
                      : "border-white/10 bg-white/5")
                  }
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                    {LETTERS[i]}
                  </span>
                  <span>{text}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#0b1020]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-md gap-3">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="rounded-2xl border border-white/20 px-5 py-4 text-sm font-semibold text-zinc-300 disabled:opacity-30"
          >
            Back
          </button>
          {last ? (
            <button
              type="button"
              onClick={confirmFinish}
              className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 py-4 text-base font-extrabold text-black active:scale-95"
            >
              Submit exam
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
              className="flex-1 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-4 text-base font-extrabold text-black active:scale-95"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </main>
  );
}