import Link from "next/link";
import { redirect } from "next/navigation";
import AvatarPreviewLazy from "@/components/scene/AvatarPreviewLazy";
import { requireUser } from "@/lib/auth/guards";
import { getMyEnrollment } from "@/lib/game/enrollment";
import { INTERESTS } from "@/lib/game/options";
import { getMyPlayer } from "@/lib/game/player";
import { formatNaira } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export default async function WelcomePage() {
  await requireUser();

  const player = await getMyPlayer();
  if (!player) redirect("/create");

  const supabase = await createClient();
  const [{ data: background }, { data: wallet }, enrollment] = await Promise.all([
    supabase.from("backgrounds").select("name").eq("slug", player.background_slug).maybeSingle(),
    supabase.from("wallets").select("balance_kobo").eq("player_id", player.id).maybeSingle(),
    getMyEnrollment(),
  ]);

  // Enrolled students go straight to their campus.
  if (enrollment) redirect("/home");

  const interest = INTERESTS.find((i) => i.value === player.interest);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1020] px-5 py-8 text-white">
      <div className="w-full max-w-sm text-center">
        <p className="text-sm font-semibold tracking-[0.3em] text-amber-400">CAMPUS LIFE</p>

        <div className="mx-auto mt-6 h-64 w-52 overflow-hidden rounded-3xl bg-gradient-to-b from-white/10 to-white/0">
          <AvatarPreviewLazy
            skin={player.avatar_skin}
            hairStyle={player.avatar_hair_style}
            hairColor={player.avatar_hair_color}
            outfit={player.avatar_outfit}
          />
        </div>

        <h1 className="mt-4 text-3xl font-extrabold">{player.display_name}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {player.age} years old · {background?.name}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 text-left">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-zinc-500">Wallet</p>
            <p className="mt-1 text-lg font-extrabold text-emerald-300">
              {wallet ? formatNaira(wallet.balance_kobo) : "-"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-zinc-500">Interest</p>
            <p className="mt-1 text-sm font-bold">
              {interest?.icon} {interest?.label}
            </p>
          </div>
        </div>

        <Link
          href="/universities"
          className="mt-6 block rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-4 text-base font-extrabold text-black active:scale-95"
        >
          Explore universities
        </Link>
        <Link
          href="/apply"
          className="mt-3 block rounded-2xl border border-amber-400/60 py-4 text-base font-extrabold text-amber-300 active:scale-95"
        >
          Apply for admission
        </Link>

        <form action="/auth/signout" method="post" className="mt-6">
          <button
            type="submit"
            className="rounded-xl border border-white/20 px-5 py-2 text-sm text-zinc-300 hover:bg-white/10"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
