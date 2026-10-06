import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import InviteForm from "./InviteForm";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function StaffPage() {
  await requireStaff("OWNER");

  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("staff_roles")
    .select("user_id, role, status, created_at")
    .order("created_at", { ascending: true });

  const ids = (staff ?? []).map((s) => s.user_id);
  const { data: identities } = ids.length
    ? await admin
        .from("auth_identities")
        .select("user_id, handle, provider")
        .in("user_id", ids)
        .in("provider", ["x", "twitter"])
    : { data: [] };

  const handleOf = new Map((identities ?? []).map((i) => [i.user_id, i.handle]));

  const { data: invites } = await admin
    .from("staff_invites")
    .select("id, role, handle_note, expires_at")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <main className="min-h-screen bg-[#070a14] px-5 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/admin" className="text-sm text-zinc-400 hover:text-white">
          Back to dashboard
        </Link>
        <p className="mt-6 text-sm font-semibold tracking-[0.3em] text-red-400">
          CAMPUS LIFE STAFF
        </p>
        <h1 className="mt-3 text-3xl font-extrabold">Staff</h1>

        <div className="mt-6 space-y-3">
          {(staff ?? []).map((s) => (
            <div
              key={s.user_id}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div>
                <p className="font-semibold">
                  {handleOf.get(s.user_id) ? `@${handleOf.get(s.user_id)}` : "Staff member"}
                </p>
                <p className="text-xs text-zinc-500">Since {formatTime(s.created_at)}</p>
              </div>
              <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold tracking-wider text-red-300">
                {s.role}
                {s.status !== "active" ? ` (${s.status})` : ""}
              </span>
            </div>
          ))}
        </div>

        {(invites ?? []).length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold">Pending invites</h2>
            <div className="mt-3 space-y-2">
              {(invites ?? []).map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                >
                  <span className="text-zinc-300">
                    {inv.handle_note || "No note"} · {inv.role}
                  </span>
                  <span className="text-xs text-zinc-500">
                    expires {formatTime(inv.expires_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          <InviteForm />
        </div>
      </div>
    </main>
  );
}