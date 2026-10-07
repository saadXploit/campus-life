import { redirect } from "next/navigation";
import RefreshButton from "@/components/RefreshButton";
import { requirePlayerId } from "@/lib/auth/guards";
import { getGameState } from "@/lib/game/gameState";
import GameClient from "./GameClient";

export default async function HomePage() {
  // Fast local login check, then ONE database call for the whole screen.
  const userId = await requirePlayerId();
  const game = await getGameState(userId);

  if (!game) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b1020] p-6 text-center text-white">
        <p className="font-bold">Your campus could not load right now.</p>
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

  return <GameClient game={game} />;
}
