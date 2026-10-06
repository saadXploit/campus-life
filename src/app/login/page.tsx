import { redirect } from "next/navigation";
import OAuthButton from "@/components/OAuthButton";
import { getCurrentUser } from "@/lib/auth/guards";

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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/welcome");

  const { error } = await searchParams;
  const message = errorMessage(error);

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