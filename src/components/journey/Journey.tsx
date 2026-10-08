import Link from "next/link";

/**
 * The look shared by every page before you reach campus: a soft glowing backdrop and a
 * header that shows where you are on the journey from new student to campus life.
 */

export type JourneyStep = "create" | "choose" | "apply" | "exam" | "result" | "campus";

const STEPS: { key: JourneyStep; label: string; icon: string }[] = [
  { key: "create", label: "Your student", icon: "🧑🏾‍🎓" },
  { key: "choose", label: "Pick a campus", icon: "🏛️" },
  { key: "apply", label: "Apply", icon: "📝" },
  { key: "exam", label: "Screening", icon: "⏱️" },
  { key: "result", label: "Result", icon: "📬" },
  { key: "campus", label: "Campus life", icon: "🎉" },
];

/** Glowing colour blobs behind the page. Put inside a `relative isolate` container. */
export function Backdrop({ tint = "#f59e0b" }: { tint?: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-25 blur-[120px]"
        style={{ backgroundColor: tint }}
      />
      <div className="absolute -right-40 top-1/3 h-[360px] w-[360px] rounded-full bg-fuchsia-600/15 blur-[110px]" />
      <div className="absolute -left-40 bottom-0 h-[360px] w-[360px] rounded-full bg-sky-600/10 blur-[110px]" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
    </div>
  );
}

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <span
        className={
          "flex items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 font-black text-black " +
          (small ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm")
        }
      >
        CL
      </span>
      <span className={"font-black tracking-tight " + (small ? "text-sm" : "text-base")}>
        CAMPUS <span className="text-amber-400">LIFE</span>
      </span>
    </Link>
  );
}

/** Logo, an optional back link, and the journey tracker. */
export function JourneyHeader({
  step,
  back,
}: {
  step: JourneyStep;
  back?: { href: string; label: string };
}) {
  const current = STEPS.findIndex((s) => s.key === step);
  return (
    <header className="mb-6">
      <div className="flex items-center justify-between gap-3">
        <Logo small />
        {back && (
          <Link
            href={back.href}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10"
          >
            ← {back.label}
          </Link>
        )}
      </div>
      <ol className="mt-5 flex items-center gap-1.5" aria-label="Your journey">
        {STEPS.map((s, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <li key={s.key} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={
                  "h-1.5 w-full rounded-full " +
                  (done ? "bg-emerald-400" : now ? "bg-gradient-to-r from-amber-300 to-orange-500" : "bg-white/10")
                }
              />
              <span
                className={
                  "hidden text-[10px] font-semibold sm:block " +
                  (now ? "text-amber-300" : done ? "text-emerald-300/80" : "text-zinc-600")
                }
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-zinc-400 sm:hidden">
        Step {current + 1} of {STEPS.length} · <span className="font-semibold text-amber-300">{STEPS[current].icon} {STEPS[current].label}</span>
      </p>
    </header>
  );
}
