import Link from "next/link";
import { redirect } from "next/navigation";
import Confetti from "@/components/Confetti";
import Countdown from "@/components/Countdown";
import UniversityCrest from "@/components/UniversityCrest";
import { requireUser } from "@/lib/auth/guards";
import { getMyOpenApplication } from "@/lib/game/applications";
import { hasPassed } from "@/lib/game/exam";
import { getMyLatestResult, revealResult } from "@/lib/game/result";
import { formatNaira } from "@/lib/money";
import { acceptOfferAction, declineOfferAction } from "./actions";

const primaryButton =
  "inline-block w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-4 text-center text-base font-extrabold text-black active:scale-95";

export default async function ResultPage() {
  const user = await requireUser();

  const app = await getMyOpenApplication();
  if (app && (app.status === "exam_pending" || app.status === "exam_in_progress")) {
    redirect("/apply/status");
  }
  if (app?.status === "awaiting_result") {
    if (!app.result_ready_at || !hasPassed(app.result_ready_at)) redirect("/apply/status");
    await revealResult(user.id);
  }

  const result = await getMyLatestResult();
  if (!result) redirect("/apply");

  const u = result.universities;
  const course = result.courses;

  const admitted =
    result.outcome === "admitted" ||
    (result.outcome === "offer" && result.offer_response === "accepted");

  if (admitted && u && course) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-[#0b1020] px-5 py-10 text-white">
        <Confetti />
        <div className="relative w-full max-w-sm text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-emerald-300">
            OFFER OF ADMISSION
          </p>
          <h1 className="mt-3 text-3xl font-black leading-tight">
            CONGRATULATIONS! YOU HAVE BEEN OFFERED ADMISSION.
          </h1>

          <div
            className="mt-6 rounded-3xl border border-white/10 p-6"
            style={{ background: `linear-gradient(160deg, ${u.primary_color}, #0b1020 90%)` }}
          >
            <UniversityCrest
              shortName={u.short_name}
              primary={u.primary_color}
              secondary={u.secondary_color}
              className="mx-auto h-24 w-20"
            />
            <p className="mt-4 text-lg font-extrabold leading-tight">{u.name}</p>
            <p className="mt-2 text-sm text-zinc-200">{course.name}</p>
            <p className="mt-1 text-xs text-zinc-300">
              100 Level ·{" "}
              {result.choice_rank
                ? result.choice_rank === 1
                  ? "Your first choice"
                  : `Your choice ${result.choice_rank}`
                : "Change of course"}
            </p>
          </div>

          <p className="mt-4 text-sm text-zinc-400">
            Fees are {formatNaira(u.tuition_per_semester_kobo)} per semester. Fees start
            when term begins.
          </p>

          <Link href="/welcome" className={`${primaryButton} mt-6`}>
            Begin first semester
          </Link>
        </div>
      </main>
    );
  }

  if (result.outcome === "offer" && !result.offer_response && u && course) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b1020] px-5 py-10 text-white">
        <div className="w-full max-w-sm text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-amber-300">
            A DIFFERENT OFFER
          </p>
          <h1 className="mt-3 text-2xl font-extrabold">
            You did not reach the entry standard for your chosen course.
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            But the admissions office has a place for you.
          </p>

          <div
            className="mt-6 rounded-3xl border border-white/10 p-6"
            style={{ background: `linear-gradient(160deg, ${u.primary_color}, #0b1020 90%)` }}
          >
            <UniversityCrest
              shortName={u.short_name}
              primary={u.primary_color}
              secondary={u.secondary_color}
              className="mx-auto h-20 w-16"
            />
            <p className="mt-3 font-extrabold leading-tight">{u.name}</p>
            <p className="mt-2 text-sm text-zinc-200">{course.name}</p>
            <p className="mt-1 text-xs text-zinc-300">
              {formatNaira(u.tuition_per_semester_kobo)} per semester
            </p>
          </div>

          <form action={acceptOfferAction} className="mt-6">
            <button type="submit" className={primaryButton}>
              Accept this offer
            </button>
          </form>
          <form action={declineOfferAction} className="mt-3">
            <button
              type="submit"
              className="w-full rounded-2xl border border-white/20 py-4 text-sm font-semibold text-zinc-300"
            >
              Decline and try again later
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Rejected, or an offer that was declined.
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1020] px-5 py-10 text-white">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-400/15 text-3xl">
          📭
        </div>
        <p className="mt-4 text-xs font-semibold tracking-[0.3em] text-red-300">
          NOT THIS TIME
        </p>
        <h1 className="mt-2 text-2xl font-extrabold">
          You were not offered admission this round.
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Plenty of great students have a second attempt. Use the time to rethink your
          choices.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-zinc-500">You can apply again in</p>
          <p className="mt-2 text-3xl font-extrabold">
            {result.reapply_at ? (
              <Countdown target={result.reapply_at}>
                <Link href="/apply" className={primaryButton}>
                  Apply again
                </Link>
              </Countdown>
            ) : (
              <Link href="/apply" className={primaryButton}>
                Apply again
              </Link>
            )}
          </p>
        </div>

        <Link href="/welcome" className="mt-6 block text-sm text-zinc-400 hover:text-white">
          Back to my student
        </Link>
      </div>
    </main>
  );
}