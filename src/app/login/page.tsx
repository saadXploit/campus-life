import Link from "next/link";
import OAuthButton from "@/components/OAuthButton";
import { Backdrop, Logo } from "@/components/journey/Journey";

const PERKS = [
  { icon: "🏫", text: "Explore a 3D Nigerian campus in real time" },
  { icon: "📚", text: "Lectures, exams, GPA and graduation" },
  { icon: "💼", text: "Jobs paying up to ₦20,000 a shift" },
  { icon: "👥", text: "Friends, outings and dating (18+)" },
];
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
      <main className="relative isolate flex min-h-screen items-center justify-center px-5 text-white">
        <Backdrop />
        <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#0f1530]/80 p-7 text-center backdrop-blur">
          <Logo small />
          <h1 className="mt-5 text-2xl font-extrabold">You are already signed in</h1>
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
    <main className="relative isolate flex min-h-screen items-center justify-center px-5 py-10 text-white">
      <Backdrop />
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f1530]/80 backdrop-blur md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-amber-400/20 via-orange-500/10 to-fuchsia-500/20 p-8 md:flex">
          <Logo />
          <div>
            <p className="text-3xl font-black leading-tight">Your four years start here.</p>
            <ul className="mt-6 space-y-3">
              {PERKS.map((p) => (
                <li key={p.text} className="flex items-center gap-3 text-sm text-zinc-200">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-lg">{p.icon}</span>
                  {p.text}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-zinc-400">Free to play. Real players, one living campus.</p>
        </div>
      <div className="w-full p-7 sm:p-10">
        <div className="md:hidden">
          <Logo small />
        </div>
        <h1 className="mt-6 text-3xl font-extrabold md:mt-0">Enter the campus</h1>
        <p className="mt-2 text-sm text-zinc-400">
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

        <p className="mt-8 text-xs text-zinc-500">
          We never see your password. Your login account stays separate from your game identity. By signing in you
          agree to the{" "}
          <Link href="/terms" className="underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline">
            Privacy policy
          </Link>
          .
        </p>
        <Link href="/" className="mt-4 inline-block text-xs text-zinc-400 underline">
          ← Back to the home page
        </Link>
      </div>
      </div>
    </main>
  );
}
