import Link from "next/link";
import { redirect } from "next/navigation";
import RefreshButton from "@/components/RefreshButton";
import { requirePlayerId } from "@/lib/auth/guards";
import { getGameState } from "@/lib/game/gameState";
import CampusMap from "./CampusMap";

export default async function CampusPage() {
  // Fast local login check, then ONE database call.
  const userId = await requirePlayerId();
  const game = await getGameState(userId);

  if (!game) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b1020] p-6 text-center text-white">
        <p className="font-bold">The campus map could not load right now.</p>
        <RefreshButton>Try again</RefreshButton>
      </main>
    );
  }

  if (game.status !== "ok") {
    redirect(
      game.status === "no_player"
        ? "/create"
        : game.status === "not_enrolled"
          ? "/welcome"
          : "/login?error=suspended"
    );
  }

  const university = game.enrollment.university;

  return (
    <main className="min-h-screen bg-[#0b1020] px-4 pb-40 pt-6 text-white">
      <div className="mx-auto max-w-md">
        <Link href="/home" className="text-sm text-zinc-400 hover:text-white">
          Back
        </Link>
        <p className="mt-5 text-xs font-semibold tracking-[0.3em] text-amber-400">CAMPUS MAP</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight">{university.name}</h1>

        <div className="mt-3 flex gap-3 text-sm">
          <span className="rounded-full bg-white/10 px-3 py-1">⚡ {game.state.energy}% energy</span>
        </div>

        <div className="mt-5">
          <CampusMap
            locations={game.locations}
            currentKind={game.state.location_kind}
            energy={game.state.energy}
            primary={university.primary_color}
            secondary={university.secondary_color}
          />
        </div>
      </div>
    </main>
  );
}
