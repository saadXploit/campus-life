"use client";

import { useActionState, useState } from "react";
import { createInviteAction } from "./actions";

export default function InviteForm() {
  const [state, formAction, pending] = useActionState(createInviteAction, null);
  const [copied, setCopied] = useState(false);

  async function copy(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const field =
    "mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-red-400";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-lg font-bold">Invite a staff member</h2>

      <form action={formAction} className="mt-4 space-y-4">
        <label className="block text-sm text-zinc-300">
          Role
          <select name="role" defaultValue="MODERATOR" className={field}>
            <option value="MODERATOR">MODERATOR</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </select>
        </label>

        <label className="block text-sm text-zinc-300">
          Note (who is this for?)
          <input name="note" maxLength={60} placeholder="e.g. Chidi, moderator" className={field} />
        </label>

        <label className="block text-sm text-zinc-300">
          Link valid for
          <select name="hours" defaultValue="24" className={field}>
            <option value="24">24 hours</option>
            <option value="72">3 days</option>
            <option value="168">7 days</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "Creating..." : "Create invite link"}
        </button>
      </form>

      {state?.error && <p className="mt-3 text-sm text-red-300">{state.error}</p>}

      {state?.link && (
        <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
          <p className="text-xs font-semibold text-amber-300">
            Copy this link now. It is shown only once and works for one person.
          </p>
          <p className="mt-2 break-all text-xs text-zinc-300">{state.link}</p>
          <button
            type="button"
            onClick={() => copy(state.link!)}
            className="mt-3 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white hover:bg-white/10"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}