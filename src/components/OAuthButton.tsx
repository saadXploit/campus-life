"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

type Props = {
  provider: "x" | "google";
  label: string;
  callbackPath: string;
};

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function OAuthButton({ provider, label, callbackPath }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${callbackPath}` },
    });
    if (error) {
      setError("Could not start sign-in. Please try again.");
      setBusy(false);
    }
  }

  const isX = provider === "x";

  return (
    <div className="w-full">
      <motion.button
        type="button"
        onClick={start}
        disabled={busy}
        whileTap={{ scale: 0.97 }}
        className={
          "flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-base font-semibold transition disabled:opacity-60 " +
          (isX
            ? "bg-white text-black hover:bg-zinc-200"
            : "border border-white/20 bg-white/5 text-white hover:bg-white/10")
        }
      >
        {isX ? (
          <XLogo />
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-black">
            G
          </span>
        )}
        {busy ? "Opening..." : label}
      </motion.button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}