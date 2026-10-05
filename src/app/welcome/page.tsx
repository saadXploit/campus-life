import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export default async function WelcomePage() {
  await requireUser();

  const supabase = await createClient();
  const { data: identities } = await supabase
    .from("auth_identities")
    .select("provider, handle");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1020] px-5 text-white">
      <div className="w-full max-w-sm text-center">
        <p className="text-sm font-semibold tracking-[0.3em] text-amber-400">CAMPUS LIFE</p>
        <h1 className="mt-3 text-3xl font-extrabold">You are in.</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Character creation and the admission journey are coming in Stage 2.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-sm">
          <p className="mb-2 font-semibold text-zinc-300">Signed in with</p>
          {identities && identities.length > 0 ? (
            identities.map((i, n) => (
              <p key={n} className="text-zinc-400">
                {i.provider}
                {i.handle ? ` (@${i.handle})` : ""}
              </p>
            ))
          ) : (
            <p className="text-zinc-500">No identity recorded yet.</p>
          )}
        </div>

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
