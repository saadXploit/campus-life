import Link from "next/link";
import OAuthButton from "@/components/OAuthButton";
import { getCurrentUser } from "@/lib/auth/guards";
import { getMyPlayer } from "@/lib/game/player";

function errorMessage(code?: string): string | null {
  switch (code) {
    case "missing_code":
      return "Sign-in was cancelled or incomplete. Please try again.";
    case "auth_failed":
      return "Sign-in failed. Please try again.";
    case "suspended":
      return "This account is not allowed to sign in.";
    case "too_many":
      return "Too many attempts. Please wait a few minutes and try again.";
    default:
      return null;
  }
}

const PROVIDER_NAMES: Record<string, string> = { x: "X", twitter: "X", google: "Google" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  const { error } = await searchParams;
  const message = errorMessage(error);

  // Already signed in: say who, and offer to switch instead of silently continuing.
  if (user) {
    const player = await getMyPlayer();
    const providers = [...new Set((user.identities ?? []).map((i) => PROVIDER_NAMES[i.provider] ?? i.provider))];
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b1020] px-5 text-white">
        <div className="w-full max-w-sm text-center">
          <p className="text-sm font-semibold tracking-[0.3em] text-amber-400">CAMPUS LIFE</p>
          <h1 className="mt-3 text-2xl font-extrabold">You are already signed in</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {player ? (
              <>
                As <span className="font-bold text-white">{player.display_name}</span>
              </>
            ) : (
              "No student created yet"
            )}
            {providers.length > 0 && <> · with {providers.join(" and ")}</>}
          </p>

          <Link
            href="/welcome"
            className="mt-8 block rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-4 font-extrabold text-black active:scale-95"
          >
            Continue{player ? ` as ${player.display_name}` : ""}
          </Link>
          <form action="/auth/signout" method="post" className="mt-3">
            <button
              type="submit"
              className="w-full rounded-2xl border border-white/20 py-4 text-sm font-semibold text-zinc-200 hover:bg-white/10"
            >
              Sign out and use another account
            </button>
          </form>
          <p className="mt-6 text-xs text-zinc-500">
            Testing with two players at once? Use a private (incognito) window or another browser
            for the second account. Windows in the same browser share one sign-in.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1020] px-5 text-white">
      <div className="w-full max-w-sm">
        <p className="text-center text-sm font-semibold tracking-[0.3em] text-amber-400">
          CAMPUS LIFE
        </p>
        <h1 className="mt-3 text-center text-3xl font-extrabold">Enter the campus</h1>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Sign in to create your student and start your story.
        </p>

        {message && (
          <p className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-center text-sm text-red-300">
            {message}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <OAuthButton provider="x" label="Continue with X" callbackPath="/auth/callback" />
          <OAuthButton provider="google" label="Continue with Google" callbackPath="/auth/callback" />
        </div>

        <p className="mt-8 text-center text-xs text-zinc-500">
          We never see your password. Your login account stays separate from your game identity.
        </p>
      </div>
    </main>
  );
}
