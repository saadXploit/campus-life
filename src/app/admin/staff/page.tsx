import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import ConfirmButton from "@/components/ConfirmButton";
import InviteForm from "./InviteForm";
import {
  changeRoleAction,
  removeStaffAction,
  setStatusAction,
} from "./manage-actions";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errorText(code?: string): string | null {
  switch (code) {
    case "not_allowed":
      return "That change is not allowed.";
    case "invalid":
      return "Something was wrong with that request.";
    case "failed":
      return "The change could not be saved. Nothing was changed.";
    default:
      return null;
  }
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireStaff("OWNER");
  const { error } = await searchParams;
  const message = errorText(error);

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

  const small =
    "rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white hover:bg-white/10";

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

        {message && (
          <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {message}
          </p>
        )}

        <div className="mt-6 space-y-3">
          {(staff ?? []).map((s) => {
            const isOwner = s.role === "OWNER";
            const handle = handleOf.get(s.user_id);
            return (
              <div
                key={s.user_id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">
                      {handle ? `@${handle}` : "Staff member"}
                    </p>
                    <p className="text-xs text-zinc-500">Since {formatTime(s.created_at)}</p>
                  </div>
                  <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold tracking-wider text-red-300">
                    {s.role}
                    {s.status !== "active" ? ` (${s.status})` : ""}
                  </span>
                </div>

                {isOwner ? (
                  <p className="mt-3 text-xs text-zinc-500">
                    The owner cannot be changed, suspended or removed.
                  </p>
                ) : (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <form action={changeRoleAction} className="flex items-center gap-2">
                      <input type="hidden" name="user_id" value={s.user_id} />
                      <select
                        name="role"
                        defaultValue={s.role}
                        className="rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-white"
                      >
                        <option value="MODERATOR">MODERATOR</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      </select>
                      <button type="submit" className={small}>
                        Change role
                      </button>
                    </form>

                    <form action={setStatusAction}>
                      <input type="hidden" name="user_id" value={s.user_id} />
                      <input
                        type="hidden"
                        name="status"
                        value={s.status === "active" ? "suspended" : "active"}
                      />
                      <button type="submit" className={small}>
                        {s.status === "active" ? "Suspend" : "Reactivate"}
                      </button>
                    </form>

                    <form action={removeStaffAction}>
                      <input type="hidden" name="user_id" value={s.user_id} />
                      <ConfirmButton
                        message="Remove this person from the staff team?"
                        className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                      >
                        Remove
                      </ConfirmButton>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
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