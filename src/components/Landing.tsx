"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const chips = [
  { label: "₦47,500", tone: "text-emerald-300 border-emerald-400/30" },
  { label: "Energy 78%", tone: "text-amber-300 border-amber-400/30" },
  { label: "Reputation +4", tone: "text-fuchsia-300 border-fuchsia-400/30" },
  { label: "Attendance 92%", tone: "text-sky-300 border-sky-400/30" },
];

const paths = [
  { icon: "🎓", name: "The Scholar", text: "Chase first class honours, tutor others, and become the name lecturers remember." },
  { icon: "💼", name: "The Hustler", text: "Start small, win customers, hire classmates, and build a campus empire." },
  { icon: "🎉", name: "The Socialite", text: "Throw the party everyone talks about. Reputation is its own currency." },
  { icon: "💘", name: "The Heartbreaker", text: "Love, drama and plot twists. Every choice changes the story." },
  { icon: "⚖️", name: "The All-Rounder", text: "Balance grades, money, friends and health. Harder than it sounds." },
  { icon: "🔥", name: "The Wildcard", text: "Skip lectures, chase the vibe, and see how long the luck lasts." },
];

const steps = [
  { n: "1", title: "Create your student", text: "Pick a background, a look, and what you want to study." },
  { n: "2", title: "Win admission", text: "Choose universities, sit the screening, and wait for the result." },
  { n: "3", title: "Live the story", text: "Lectures, hustles, parties, friends, rivals. Nobody has the same four years." },
];

export default function Landing({ signedIn }: { signedIn: boolean }) {
  const href = signedIn ? "/welcome" : "/login";
  const cta = signedIn ? "Continue your story" : "Start your story";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0b1020] text-white">
      {/* HERO */}
      <section className="relative isolate px-5 pb-16 pt-14 sm:pt-24">
        <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-amber-500/20 blur-[110px]" />
        <div className="pointer-events-none absolute right-[-120px] top-40 -z-10 h-[300px] w-[300px] rounded-full bg-fuchsia-600/20 blur-[100px]" />

        <div className="mx-auto max-w-3xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-semibold tracking-[0.35em] text-amber-400 sm:text-sm"
          >
            A MULTIPLAYER UNIVERSITY LIFE SIMULATION
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-5 text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl"
          >
            LIVE YOUR
            <span className="block bg-gradient-to-r from-amber-300 via-orange-400 to-fuchsia-400 bg-clip-text text-transparent">
              CAMPUS LIFE
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-6 max-w-xl text-base text-zinc-300 sm:text-lg"
          >
            Lectures, side hustles, parties, rivalries and romance. Make money, chase grades,
            build your name, or wreck it all. Real players share one living campus.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-9 flex flex-col items-center gap-3"
          >
            <Link
              href={href}
              className="w-full max-w-xs rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-4 text-center text-base font-extrabold text-black shadow-lg shadow-orange-500/30 transition active:scale-95 sm:w-auto"
            >
              {cta}
            </Link>
            <p className="text-xs text-zinc-500">Sign in with X or Google. No passwords.</p>
          </motion.div>

          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {chips.map((chip, i) => (
              <motion.span
                key={chip.label}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3 + i * 0.6, repeat: Infinity, ease: "easeInOut" }}
                className={`rounded-full border bg-white/5 px-4 py-1.5 text-sm font-semibold backdrop-blur ${chip.tone}`}
              >
                {chip.label}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* PATHS */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-extrabold sm:text-4xl">
            There is no single way to win
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-zinc-400">
            Every decision costs time, energy or money. Choose your path and live with it.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paths.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: (i % 3) * 0.08 }}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur"
              >
                <div className="text-3xl">{p.icon}</div>
                <h3 className="mt-3 text-lg font-bold">{p.name}</h3>
                <p className="mt-1 text-sm text-zinc-400">{p.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT STARTS */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-extrabold sm:text-4xl">How it starts</h2>
          <div className="mt-10 space-y-4">
            {steps.map((s) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="flex items-start gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-lg font-black text-black">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-bold">{s.title}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{s.text}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href={href}
              className="inline-block rounded-2xl bg-white px-8 py-4 text-base font-extrabold text-black transition active:scale-95"
            >
              {cta}
            </Link>
          </div>
        </div>
      </section>

      <footer className="px-5 pb-10 pt-6 text-center text-xs text-zinc-600">
        CAMPUS LIFE is a work of fiction. All universities, people and events are made up.
      </footer>
    </main>
  );
}