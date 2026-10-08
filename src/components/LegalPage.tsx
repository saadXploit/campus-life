import Link from "next/link";
import { Backdrop, Logo } from "@/components/journey/Journey";

/** The contact address shown on the legal pages (set NEXT_PUBLIC_CONTACT_EMAIL). */
export function contactEmail(): string | null {
  const e = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

export function Contact() {
  const email = contactEmail();
  return email ? (
    <a href={`mailto:${email}`} className="text-amber-300 underline">
      {email}
    </a>
  ) : (
    <span>the contact address shown on this site</span>
  );
}

/** Shared layout for the privacy, terms and refund pages. */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative isolate min-h-screen px-5 py-8 text-white">
      <Backdrop />
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <Logo small />
          <Link href="/" className="text-xs text-zinc-400 underline">
            Home
          </Link>
        </div>
        <article className="mt-8 space-y-4 rounded-[2rem] border border-white/10 bg-[#0f1530]/80 p-6 text-sm leading-relaxed text-zinc-300 backdrop-blur sm:p-8 [&_h2]:pt-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc">
          <h1 className="text-3xl font-extrabold text-white">{title}</h1>
          <p className="text-xs text-zinc-500">Last updated {updated}</p>
          {children}
        </article>
        <p className="mt-6 flex justify-center gap-4 text-xs text-zinc-500">
          <Link href="/privacy" className="underline">Privacy</Link>
          <Link href="/terms" className="underline">Terms</Link>
          <Link href="/refunds" className="underline">Shop and refunds</Link>
        </p>
      </div>
    </main>
  );
}
