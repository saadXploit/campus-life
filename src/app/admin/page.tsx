import { requireStaff } from "@/lib/auth/guards";
import { getXIdentity } from "@/lib/auth/staff";

export default async function AdminHomePage() {
  const { user, role } = await requireStaff();
  const handle = getXIdentity(user)?.handle;

  return (
    <main className="min-h-screen bg-[#070a14] px-5 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-semibold tracking-[0.3em] text-red-400">
          CAMPUS LIFE STAFF
        </p>
        <h1 className="mt-3 text-3xl font-extrabold">Admin dashboard</h1>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-zinc-400">Signed in as</p>
          <p className="mt-1 text-xl font-bold">{handle ? `@${handle}` : "Staff member"}</p>
          <p className="mt-3 inline-block rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold tracking-wider text-red-300">
            {role}
          </p>
        </div>

        <p className="mt-6 text-sm text-zinc-500">
          Staff management, the audit log viewer, and moderation tools arrive in the next steps.
        </p>

        <form action="/auth/signout" method="post" className="mt-8">
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