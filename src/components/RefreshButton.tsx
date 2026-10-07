"use client";

import { useRouter } from "next/navigation";

export default function RefreshButton({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="rounded-full bg-amber-400 px-4 py-1.5 text-sm font-bold text-black"
    >
      {children}
    </button>
  );
}