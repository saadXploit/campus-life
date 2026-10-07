import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { getXIdentity } from "@/lib/auth/staff";
import { can } from "@/lib/auth/roles";
import { revokeMySessionsAction } from "./session-actions";

export default async function AdminHomePage() {
  const { user, role } = await requireStaff();
  const handle = getXIdentity(user)?.handle;

  const card =
    "rounded-2xl border border-white/10 bg-white/5 p-4 font-semibold hover:bg-white/10";

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

        <div className="mt-6 grid gap-3">
          {can(role, "staff.manage") && (
            <Link href="/admin/staff" className={card}>
              Staff
              <span className="block text-sm font-normal text-zinc-400">
                See the team and invite new staff
              </span>
            </Link>
          )}
          {can(role, "audit.view") && (
            <Link href="/admin/audit" className={card}>
              Audit log
              <span className="block text-sm font-normal text-zinc-400">
                See every recorded admin action
              </span>
            </Link>
          )}
          {can(role, "reports.review") && (
            <Link href="/admin/reports" className={card}>
              Player reports
              <span className="block text-sm font-normal text-zinc-400">
                Review reports, suspend or ban players
              </span>
            </Link>
          )}
          {can(role, "ads.manage") && (
            <Link href="/admin/ads" className={card}>
              Ads
              <span className="block text-sm font-normal text-zinc-400">
                Billboards, club songs and market products
              </span>
            </Link>
          )}
          {can(role, "settings.manage") && (
            <Link href="/admin/settings" className={card}>
              Game settings
              <span className="block text-sm font-normal text-zinc-400">
                Pause new registrations, set money transfer limits
              </span>
            </Link>
          )}
          {can(role, "economy.inject") && (
            <Link href="/admin/economy" className={card}>
              Economy
              <span className="block text-sm font-normal text-zinc-400">
                Credit or debit a student&apos;s wallet (audited)
              </span>
            </Link>
          )}
        </div>

        <p className="mt-6 text-sm text-zinc-500">
          Admin sessions last 8 hours.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-xl border border-white/20 px-5 py-2 text-sm text-zinc-300 hover:bg-white/10"
            >
              Sign out
            </button>
          </form>

          <form action={revokeMySessionsAction}>
            <button
              type="submit"
              className="rounded-xl border border-red-500/40 px-5 py-2 text-sm text-red-300 hover:bg-red-500/10"
            >
              Sign out of all admin sessions
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}