import { redirect } from "next/navigation";
import OAuthButton from "@/components/OAuthButton";
import { getCurrentUser, getStaffRole } from "@/lib/auth/guards";
import { hasValidAdminSession } from "@/lib/auth/admin-session";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (
    user &&
    (await getStaffRole(user.id)) &&
    (await hasValidAdminSession(user.id))
  ) {
    redirect("/admin");
  }

  const { error } = await searchParams;
  const message =
    error === "not_authorised"
      ? "This account is not authorised for the admin portal."
            : error === "too_many"
        ? "Too many attempts. Please wait a few minutes and try again."
        : error
          ? "Sign-in failed. Please try again."
          : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070a14] px-5 text-white">
      <div className="w-full max-w-sm">
        <p className="text-center text-sm font-semibold tracking-[0.3em] text-red-400">
          CAMPUS LIFE STAFF
        </p>
        <h1 className="mt-3 text-center text-3xl font-extrabold">Admin access</h1>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Authorised staff only. Players should use the normal login.
        </p>

        {message && (
          <p className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-center text-sm text-red-300">
            {message}
          </p>
        )}

        <div className="mt-8">
          <OAuthButton provider="x" label="Continue with X" callbackPath="/admin/callback" />
        </div>
      </div>
    </main>
  );
}