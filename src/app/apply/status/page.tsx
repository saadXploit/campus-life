import Link from "next/link";
import { redirect } from "next/navigation";
import Countdown from "@/components/Countdown";
import UniversityCrest from "@/components/UniversityCrest";
import { requireUser } from "@/lib/auth/guards";
import { getMyOpenApplication } from "@/lib/game/applications";
import { formatNaira } from "@/lib/money";

export default async function ApplicationStatusPage() {
  await requireUser();

  const app = await getMyOpenApplication();
  if (!app) redirect("/apply");

  const courseName = app.application_choices[0]?.courses.name;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1020] px-5 py-10 text-white">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/20 text-3xl">
            ✅
          </div>
          <p className="mt-4 text-xs font-semibold tracking-[0.3em] text-emerald-300">
            APPLICATION SUBMITTED
          </p>
          <h1 className="mt-2 text-2xl font-extrabold">Entrance examination scheduled.</h1>
          <p className="mt-2 text-sm text-zinc-400">{courseName}</p>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
          <p className="text-xs text-zinc-500">The exam hall opens in</p>
          <p className="mt-1 text-3xl font-extrabold">
            <Countdown target={app.exam_opens_at} />
          </p>
        </div>

        <div className="mt-6 space-y-2">
          {app.application_choices.map((c) => (
            <div
              key={c.rank}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
            >
              <UniversityCrest
                shortName={c.universities.short_name}
                primary={c.universities.primary_color}
                secondary={c.universities.secondary_color}
                className="h-10 w-9 shrink-0"
              />
              <div className="flex-1">
                <p className="text-sm font-bold leading-tight">{c.universities.name}</p>
                <p className="text-xs text-zinc-500">
                  Choice {c.rank} · {formatNaira(c.universities.tuition_per_semester_kobo)} per
                  semester
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 rounded-2xl border border-dashed border-white/15 p-4 text-center text-sm text-zinc-400">
          The exam itself arrives in the next update.
        </p>

        <Link href="/welcome" className="mt-6 block text-center text-sm text-zinc-400 hover:text-white">
          Back to my student
        </Link>
      </div>
    </main>
  );
}