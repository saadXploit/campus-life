import OAuthButton from "@/components/OAuthButton";
import { isInviteUsable } from "@/lib/auth/invites";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const usable = await isInviteUsable(token);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070a14] px-5 text-white">
      <div className="w-full max-w-sm text-center">
        <p className="text-sm font-semibold tracking-[0.3em] text-red-400">
          CAMPUS LIFE STAFF
        </p>

        {usable ? (
          <>
            <h1 className="mt-3 text-3xl font-extrabold">You are invited</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Sign in with your X account to join the Campus Life staff team. This link
              works once.
            </p>
            <div className="mt-8">
              <OAuthButton
                provider="x"
                label="Continue with X"
                callbackPath={`/admin/callback?invite=${token}`}
              />
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-3xl font-extrabold">Invite not valid</h1>
            <p className="mt-2 text-sm text-zinc-400">
              This invite link has expired, was already used, or is not correct. Ask the
              owner for a new one.
            </p>
          </>
        )}
      </div>
    </main>
  );
}