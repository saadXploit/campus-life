"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import AvatarPreviewLazy from "@/components/scene/AvatarPreviewLazy";
import { Backdrop, Logo } from "@/components/journey/Journey";

const floating = [
  { label: "💰 +₦20,000 shift pay", tone: "text-emerald-300 border-emerald-400/30", pos: "left-0 top-6" },
  { label: "📚 CSC111 · A", tone: "text-sky-300 border-sky-400/30", pos: "right-0 top-16" },
  { label: "🎓 CGPA 4.52", tone: "text-amber-300 border-amber-400/30", pos: "left-2 bottom-24" },
  { label: "💚 Tolu paid for your meal", tone: "text-fuchsia-300 border-fuchsia-400/30", pos: "right-0 bottom-10" },
];

const features = [
  { icon: "🏫", title: "A real 3D campus", text: "Walk to hostels, lecture halls, the club, the market and the pitch. Go inside every building." },
  { icon: "🕒", title: "Real Nigerian time", text: "The campus runs on WAT. Morning lectures, evening football, night life at the club." },
  { icon: "📚", title: "Lectures and exams", text: "4-week semesters with live lectures, study sessions, exam week, GPA and CGPA." },
  { icon: "💼", title: "Jobs that pay", text: "POS agent, tutor, bartender and more. Earn ₦5,000 to ₦20,000 a shift and get promoted." },
  { icon: "👥", title: "Friends and outings", text: "Eat together, play football together, treat your friends, chat and start groups." },
  { icon: "👕", title: "Your style, your room", text: "Wear agbada or a suit, shades and a gold chain, and upgrade your hostel room." },
  { icon: "💘", title: "Dating (18+)", text: "Opt in, get close, ask someone out. Consent first, always." },
  { icon: "🛡️", title: "Safe and fair", text: "Every rule runs on the server. Block, report and moderators keep the campus clean." },
];

const types = [
  { name: "Federal", color: "#16a34a", perks: ["Lowest fees", "Big, crowded classes", "Lecturers can go on strike"] },
  { name: "State", color: "#2563eb", perks: ["Moderate fees", "Friendly, local feel", "Strikes are possible"] },
  { name: "Private", color: "#9333ea", perks: ["Highest fees", "Small classes, a boost in exams", "11 PM curfew with a gate fine"] },
];

const steps = [
  { icon: "🧑🏾‍🎓", title: "Create your student", text: "Name, look, background and what you love." },
  { icon: "🏛️", title: "Pick your campus", text: "10 universities: federal, state and private." },
  { icon: "📝", title: "Apply", text: "Choose a course and rank your universities." },
  { icon: "⏱️", title: "Sit the screening", text: "A short timed exam decides your admission." },
  { icon: "🎉", title: "Move in", text: "Get your hostel room and start living it." },
];

export default function Landing({ signedIn }: { signedIn: boolean }) {
  const href = signedIn ? "/welcome" : "/login";
  const cta = signedIn ? "Continue your story" : "Start your story";

  return (
    <main className="relative isolate min-h-screen overflow-x-hidden text-white">
      <Backdrop />

      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <Link
          href={href}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
        >
          {signedIn ? "Continue" : "Sign in"}
        </Link>
      </nav>

      {/* HERO */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 md:grid-cols-2 md:pt-12">
        <div className="text-center md:text-left">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-bold tracking-[0.25em] text-amber-300"
          >
            MULTIPLAYER · NIGERIAN UNIVERSITY LIFE
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
            className="mx-auto mt-6 max-w-lg text-base text-zinc-300 sm:text-lg md:mx-0"
          >
            Get admitted, attend lectures, work shifts, hang out with friends, upgrade your style and
            graduate on top. One living 3D campus, shared with real players.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-9 flex flex-col items-center gap-3 md:items-start"
          >
            <Link
              href={href}
              className="w-full max-w-xs rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-8 py-4 text-center text-base font-extrabold text-black shadow-lg shadow-orange-500/30 transition hover:brightness-110 active:scale-95 sm:w-auto"
            >
              {cta} →
            </Link>
            <p className="text-xs text-zinc-500">Free to play · Sign in with X or Google · No passwords</p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="relative mx-auto h-[380px] w-full max-w-sm sm:h-[440px]"
        >
          <div className="absolute inset-x-6 bottom-6 top-6 rounded-[2.5rem] border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.01]" />
          <div className="absolute inset-x-6 bottom-6 top-6">
            <AvatarPreviewLazy skin={3} hairStyle={1} hairColor={0} outfit={3} action="dance" />
          </div>
          {floating.map((f, i) => (
            <motion.span
              key={f.label}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3 + i * 0.7, repeat: Infinity, ease: "easeInOut" }}
              className={`absolute ${f.pos} rounded-full border bg-[#0b1020]/80 px-3 py-1.5 text-xs font-bold backdrop-blur ${f.tone}`}
            >
              {f.label}
            </motion.span>
          ))}
        </motion.div>
      </section>

      {/* FEATURES */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-extrabold sm:text-4xl">Everything a student life has</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-zinc-400">
            Every choice costs time, energy or money. Grades, hustle, friends: you decide what matters.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: (i % 4) * 0.06 }}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur transition hover:border-amber-400/30"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-2xl">{f.icon}</div>
                <h3 className="mt-4 font-bold">{f.title}</h3>
                <p className="mt-1 text-sm text-zinc-400">{f.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* UNIVERSITY TYPES */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-extrabold sm:text-4xl">Federal, state or private?</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-zinc-400">
            10 universities, each with its own fees, pressure and personality.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {types.map((t) => (
              <div key={t.name} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
                <div className="px-5 py-4" style={{ background: `linear-gradient(135deg, ${t.color}, transparent)` }}>
                  <p className="text-lg font-extrabold">{t.name}</p>
                </div>
                <ul className="space-y-2 p-5 text-sm text-zinc-300">
                  {t.perks.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span className="text-amber-400">•</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT STARTS */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-extrabold sm:text-4xl">From applicant to student in minutes</h2>
          <div className="mt-10 grid gap-3 md:grid-cols-5">
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="relative flex items-start gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:flex-col md:gap-3"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-xl">
                  {s.icon}
                </span>
                <div>
                  <p className="text-[10px] font-bold tracking-[0.2em] text-amber-300">STEP {i + 1}</p>
                  <h3 className="font-bold">{s.title}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{s.text}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 rounded-[2rem] border border-amber-400/20 bg-gradient-to-r from-amber-400/15 via-orange-500/10 to-fuchsia-500/15 p-8 text-center">
            <h3 className="text-2xl font-extrabold sm:text-3xl">Your campus is waiting.</h3>
            <p className="mt-2 text-zinc-300">Create your student now. It takes about two minutes.</p>
            <Link
              href={href}
              className="mt-6 inline-block rounded-2xl bg-white px-8 py-4 text-base font-extrabold text-black transition hover:bg-amber-100 active:scale-95"
            >
              {cta} →
            </Link>
          </div>
        </div>
      </section>

      <footer className="px-5 pb-10 pt-6 text-center text-xs text-zinc-600">
        <span className="flex justify-center gap-4">
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
          <Link href="/terms" className="underline">
            Terms
          </Link>
          <Link href="/refunds" className="underline">
            Shop and refunds
          </Link>
        </span>
        <p className="mt-2">CAMPUS LIFE is a work of fiction. All universities, people and events are made up.</p>
      </footer>
    </main>
  );
}
