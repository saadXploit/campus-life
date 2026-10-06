import Link from "next/link";
import { redirect } from "next/navigation";
import StatBar from "@/components/StatBar";
import UniversityCrest from "@/components/UniversityCrest";
import { requireUser } from "@/lib/auth/guards";
import { getMyPlayer } from "@/lib/game/player";
import { TYPE_LABEL, competitiveness, listUniversities } from "@/lib/game/universities";
import { formatNaira } from "@/lib/money";

export default async function UniversitiesPage() {
  await requireUser();
  if (!(await getMyPlayer())) redirect("/create");

  const universities = await listUniversities();

  return (
    <main className="min-h-screen bg-[#0b1020] px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <Link href="/welcome" className="text-sm text-zinc-400 hover:text-white">
          Back
        </Link>
        <p className="mt-6 text-xs font-semibold tracking-[0.3em] text-amber-400">
          CAMPUS LIFE
        </p>
        <h1 className="mt-2 text-3xl font-extrabold">Choose your campus</h1>
        <p className="mt-1 max-w-xl text-sm text-zinc-400">
          Each university has its own fees, pressure and personality. Tap one to see what
          it offers.
        </p>

        {universities.length === 0 && (
          <p className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-400">
            No universities are open right now. Please check back soon.
          </p>
        )}

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {universities.map((u) => (
            <Link
              key={u.id}
              href={`/universities/${u.slug}`}
              className="block overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] transition active:scale-[0.98] md:hover:-translate-y-1"
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