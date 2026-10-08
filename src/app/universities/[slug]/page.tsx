import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { JourneyHeader } from "@/components/journey/Journey";
import StatBar from "@/components/StatBar";
import UniversityCrest from "@/components/UniversityCrest";
import { requireUser } from "@/lib/auth/guards";
import { getMyPlayer } from "@/lib/game/player";
import { TYPE_LABEL, TYPE_PERKS, competitiveness, getUniversity } from "@/lib/game/universities";
import { formatNaira } from "@/lib/money";

export default async function UniversityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireUser();
  if (!(await getMyPlayer())) redirect("/create");

  const { slug } = await params;
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) notFound();

  const result = await getUniversity(slug);
  if (!result) notFound();
  const { university: u, faculties } = result;

  return (
    <main className="min-h-screen bg-[#0b1020] pb-28 text-white">
      <div
        className="px-4 pb-8 pt-6"
        style={{ background: `linear-gradient(160deg, ${u.primary_color}, #0b1020 85%)` }}
      >
        <div className="mx-auto max-w-3xl">
          <JourneyHeader step="choose" back={{ href: "/universities", label: "All universities" }} />
          <div className="mt-2 flex items-center gap-4">
            <UniversityCrest
              shortName={u.short_name}
              primary={u.primary_color}
              secondary={u.secondary_color}
              className="h-24 w-20 shrink-0"
            />
            <div>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black"
                style={{ backgroundColor: u.secondary_color }}
              >
                {TYPE_LABEL[u.type]}
              </span>
              <h1 className="mt-2 text-2xl font-extrabold leading-tight">{u.name}</h1>
              <p className="mt-1 text-sm italic text-zinc-200">{u.tagline}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 px-4">
        <p className="text-sm leading-relaxed text-zinc-300">{u.description}</p>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold tracking-[0.2em] text-amber-300">
            {TYPE_LABEL[u.type].toUpperCase()} UNIVERSITY LIFE
          </p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-200">
            {TYPE_PERKS[u.type].map((perk) => (
              <li key={perk}>• {perk}</li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-zinc-500">Fees per semester</p>
            <p className="mt-1 text-lg font-extrabold text-emerald-300">
              {formatNaira(u.tuition_per_semester_kobo)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-zinc-500">Getting in</p>
            <p className="mt-1 text-lg font-extrabold text-amber-300">
              {competitiveness(u.difficulty)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-zinc-500">Reputation</p>
            <p className="mt-1 text-lg font-extrabold">{u.reputation}/100</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-zinc-500">Students on campus</p>
            <p className="mt-1 text-lg font-extrabold">
              {u.student_population.toLocaleString("en-NG")}
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
          <StatBar label="Academic pressure" value={u.difficulty} color="#f87171" />
          <StatBar label="Party scene" value={u.party_level} color="#e879f9" />
          <StatBar label="Hustle scene" value={u.hustle_level} color="#34d399" />
        </div>

        <div>
          <h2 className="text-xl font-extrabold">Faculties and courses</h2>
          <div className="mt-3 space-y-3">
            {faculties.map((f) => {
              const courses = f.departments.flatMap((d) => d.courses);
              return (
                <details
                  key={f.id}
                  className="rounded-2xl border border-white/10 bg-white/5 open:bg-white/[0.07]"
                >
                  <summary className="cursor-pointer p-4 font-semibold">
                    {f.name}
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      {courses.length} courses
                    </span>
                  </summary>
                  <div className="space-y-2 px-4 pb-4">
                    {courses.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-200">{c.name}</span>
                        <span className="text-xs text-zinc-500">
                          {c.code} · {c.duration_years} yrs
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </div>

      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#0b1020]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{u.name}</p>
            <p className="text-xs text-zinc-400">{formatNaira(u.tuition_per_semester_kobo)} a semester · {competitiveness(u.difficulty)}</p>
          </div>
          <Link
            href="/apply"
            className="shrink-0 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3 text-sm font-extrabold text-black active:scale-95"
          >
            Apply →
          </Link>
        </div>
      </div>
    </main>
  );
}