import Link from "next/link";
import { redirect } from "next/navigation";
import { Backdrop, JourneyHeader } from "@/components/journey/Journey";
import StatBar from "@/components/StatBar";
import UniversityCrest from "@/components/UniversityCrest";
import { requireUser } from "@/lib/auth/guards";
import { getMyPlayer } from "@/lib/game/player";
import { TYPE_LABEL, competitiveness, listUniversities } from "@/lib/game/universities";
import { formatNaira } from "@/lib/money";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "federal", label: "Federal" },
  { key: "state", label: "State" },
  { key: "private", label: "Private" },
] as const;

export default async function UniversitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await requireUser();
  if (!(await getMyPlayer())) redirect("/create");

  const { type } = await searchParams;
  const filter = FILTERS.some((x) => x.key === type) ? (type as string) : "all";
  const all = await listUniversities();
  const universities = filter === "all" ? all : all.filter((u) => u.type === filter);

  return (
    <main className="relative isolate min-h-screen px-4 py-6 text-white">
      <Backdrop />
      <div className="mx-auto max-w-5xl">
        <JourneyHeader step="choose" back={{ href: "/welcome", label: "Back" }} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">Choose your campus</h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-400">
              Each university has its own fees, pressure and personality. Tap one to see what it offers.
            </p>
          </div>
          <Link
            href="/apply"
            className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-sm font-extrabold text-black active:scale-95"
          >
            Apply now →
          </Link>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((x) => (
            <Link
              key={x.key}
              href={x.key === "all" ? "/universities" : `/universities?type=${x.key}`}
              className={
                "shrink-0 rounded-full px-4 py-2 text-sm font-semibold " +
                (filter === x.key ? "bg-white text-black" : "border border-white/15 bg-white/5 text-zinc-300")
              }
            >
              {x.label}
              <span className="ml-1 text-xs opacity-60">
                {x.key === "all" ? all.length : all.filter((u) => u.type === x.key).length}
              </span>
            </Link>
          ))}
        </div>

        {universities.length === 0 && (
          <p className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-400">
            No universities are open right now. Please check back soon.
          </p>
        )}

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {universities.map((u) => (
            <Link
              key={u.id}
              href={`/universities/${u.slug}`}
              className="block overflow-hidden rounded-3xl border border-white/10 bg-[#0f1530]/80 backdrop-blur transition hover:border-white/25 active:scale-[0.98] md:hover:-translate-y-1"
            >
              <div
                className="flex items-center gap-4 p-5"
                style={{ background: `linear-gradient(135deg, ${u.primary_color}, #0b1020)` }}
              >
                <UniversityCrest
                  shortName={u.short_name}
                  primary={u.primary_color}
                  secondary={u.secondary_color}
                  className="h-16 w-14 shrink-0"
                />
                <div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black"
                    style={{ backgroundColor: u.secondary_color }}
                  >
                    {TYPE_LABEL[u.type]}
                  </span>
                  <h2 className="mt-1 text-lg font-extrabold leading-tight">{u.name}</h2>
                </div>
              </div>

              <div className="p-5">
                <p className="text-sm italic text-zinc-300">{u.tagline}</p>

                <div className="mt-4 space-y-3">
                  <StatBar label="Academic pressure" value={u.difficulty} color="#f87171" />
                  <StatBar label="Party scene" value={u.party_level} color="#e879f9" />
                  <StatBar label="Hustle scene" value={u.hustle_level} color="#34d399" />
                </div>

                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-zinc-500">Fees per semester</p>
                    <p className="text-lg font-extrabold text-emerald-300">
                      {formatNaira(u.tuition_per_semester_kobo)}
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-amber-300">
                    {competitiveness(u.difficulty)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}