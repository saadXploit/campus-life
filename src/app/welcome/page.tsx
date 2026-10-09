import Link from "next/link";
import { redirect } from "next/navigation";
import { Backdrop, JourneyHeader, type JourneyStep } from "@/components/journey/Journey";
import AvatarPreviewLazy from "@/components/scene/AvatarPreviewLazy";
import { requireUser } from "@/lib/auth/guards";
import { getMyOpenApplication } from "@/lib/game/applications";
import { getMyEnrollment } from "@/lib/game/enrollment";
import { INTERESTS } from "@/lib/game/options";
import { getMyPlayer } from "@/lib/game/player";
import { formatNaira } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

const primary =
  "block rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-4 text-center text-base font-extrabold text-black shadow-lg shadow-orange-500/20 transition hover:brightness-110 active:scale-95";
const secondary =
  "block rounded-2xl border border-white/15 bg-white/5 py-4 text-center text-sm font-bold text-zinc-200 transition hover:bg-white/10 active:scale-95";

export default async function WelcomePage() {
  await requireUser();

  const player = await getMyPlayer();
  if (!player) redirect("/create");

  const supabase = await createClient();
  const [{ data: background }, { data: wallet }, enrollment, application] = await Promise.all([
    supabase.from("backgrounds").select("name").eq("slug", player.background_slug).maybeSingle(),
    supabase.from("wallets").select("balance_kobo").eq("player_id", player.id).maybeSingle(),
    getMyEnrollment(),
    getMyOpenApplication(),
  ]);

  // Enrolled students go straight to their campus.
  if (enrollment) redirect("/home");

  const interest = INTERESTS.find((i) => i.value === player.interest);

  // The one next thing to do, depending on where the application is.
  let step: JourneyStep = "choose";
  let next = { title: "Pick your campus", text: "Federal, state or private: compare the three, then apply.", href: "/universities", cta: "Explore universities" };
  if (application?.status === "exam_pending" || application?.status === "exam_in_progress") {
    step = "exam";
    next = {
      title: application.status === "exam_in_progress" ? "Your screening is in progress" : "Your screening is booked",
      text: "Sit the short timed exam. Your score decides your admission.",
      href: "/apply/status",
      cta: "Go to my screening",
    };
  } else if (application?.status === "awaiting_result" || application?.status === "offer_pending") {
    step = "result";
    next = {
      title: application.status === "offer_pending" ? "Your result is in!" : "Waiting for your result",
      text: "See what the admissions office decided.",
      href: application.status === "offer_pending" ? "/apply/result" : "/apply/status",
      cta: "See my result",
    };
  }

  return (
    <main className="relative isolate min-h-screen px-5 py-6 text-white">
      <Backdrop />
      <div className="mx-auto max-w-4xl">
        <JourneyHeader step={step} />

        <div className="grid items-center gap-8 md:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.01] p-5 text-center">
            <div className="mx-auto h-72 w-full max-w-xs">
              <AvatarPreviewLazy
                skin={player.avatar_skin}
                hairStyle={player.avatar_hair_style}
                hairColor={player.avatar_hair_color}
                outfit={player.avatar_outfit}
              />
            </div>
            <h1 className="mt-2 text-3xl font-extrabold">{player.display_name}</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {player.age} years old · {background?.name}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] text-zinc-500">Wallet</p>
                <p className="mt-0.5 text-lg font-extrabold text-emerald-300">
                  {wallet ? formatNaira(wallet.balance_kobo) : "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] text-zinc-500">Interest</p>
                <p className="mt-0.5 text-sm font-bold">
                  {interest?.icon} {interest?.label}
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-amber-300">NEXT STEP</p>
            <h2 className="mt-2 text-3xl font-extrabold leading-tight">{next.title}</h2>
            <p className="mt-2 text-zinc-400">{next.text}</p>
            <div className="mt-6 space-y-3">
              <Link href={next.href} className={primary}>
                {next.cta} →
              </Link>
              {step === "choose" && (
                <Link href="/apply" className={secondary}>
                  I know where I want to go: apply now
                </Link>
              )}
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
              <p className="font-semibold text-zinc-200">How admission works</p>
              <p className="mt-1">
                Choose a course and up to three universities, sit a short screening exam, then get your result.
                Once admitted you move into your hostel room on campus.
              </p>
            </div>

            <form action="/auth/signout" method="post" className="mt-6">
              <button type="submit" className="text-xs text-zinc-500 underline hover:text-zinc-300">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
