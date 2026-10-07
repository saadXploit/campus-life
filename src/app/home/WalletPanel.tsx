"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { formatNaira, parseNairaToKobo } from "@/lib/money";
import {
  searchPlayersAction,
  sendMoneyAction,
  walletHistoryAction,
  type LedgerLine,
  type PlayerResult,
} from "./wallet-actions";

type Step =
  | { name: "pick" }
  | { name: "amount"; to: PlayerResult }
  | { name: "confirm"; to: PlayerResult; kobo: number; note: string; key: string }
  | { name: "done"; to: PlayerResult; kobo: number };

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function WalletPanel({
  balance,
  onClose,
  onSent,
}: {
  balance: number;
  onClose: () => void;
  onSent: () => void;
}) {
  const [tab, setTab] = useState<"send" | "history">("send");
  const [step, setStep] = useState<Step>({ name: "pick" });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<LedgerLine[] | null>(null);
  const [pending, startTransition] = useTransition();
  const searchId = useRef(0);

  // Search as the player types (after a short pause).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const id = ++searchId.current;
    const t = setTimeout(async () => {
      setSearching(true);
      const found = await searchPlayersAction(q);
      if (id === searchId.current) {
        setResults(found);
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (tab !== "history" || history) return;
    let live = true;
    walletHistoryAction().then((h) => live && setHistory(h));
    return () => {
      live = false;
    };
  }, [tab, history]);

  function review() {
    if (step.name !== "amount") return;
    const kobo = parseNairaToKobo(amount);
    if (!kobo) return setError("Enter a whole naira amount, like 5000.");
    if (kobo > balance) return setError("You do not have that much.");
    setError(null);
    // One key per confirm screen: pressing Send twice can never send twice.
    setStep({ name: "confirm", to: step.to, kobo, note: note.trim(), key: newKey() });
  }

  function send() {
    if (step.name !== "confirm") return;
    const s = step;
    setError(null);
    startTransition(async () => {
      const result = await sendMoneyAction({
        toPlayerId: s.to.id,
        amountKobo: s.kobo,
        note: s.note,
        key: s.key,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStep({ name: "done", to: s.to, kobo: s.kobo });
      setHistory(null);
      onSent();
    });
  }

  function restart() {
    setStep({ name: "pick" });
    setQuery("");
    setResults([]);
    setAmount("");
    setNote("");
    setError(null);
  }

  const input =
    "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-base outline-none focus:border-amber-400";
  const primary =
    "w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 font-extrabold text-black disabled:opacity-40 active:scale-95";

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#10172e] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-amber-300">WALLET</p>
            <p className="text-3xl font-black text-emerald-300">{formatNaira(balance)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl text-zinc-400">
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1 text-sm font-semibold">
          {(["send", "history"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={"rounded-lg py-2 " + (tab === t ? "bg-white/15" : "text-zinc-400")}
            >
              {t === "send" ? "Send money" : "History"}
            </button>
          ))}
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-500/15 p-3 text-sm text-red-200">{error}</p>}

        {tab === "send" && step.name === "pick" && (
          <div className="mt-4">
            <label className="text-sm text-zinc-300" htmlFor="who">
              Who are you sending to?
            </label>
            <input
              id="who"
              className={input + " mt-2"}
              placeholder="Start typing a student's name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              maxLength={20}
            />
            <div className="mt-3 space-y-2">
              {query.trim().length >= 2 && searching && <p className="text-sm text-zinc-400">Searching...</p>}
              {query.trim().length >= 2 && !searching && results.length === 0 && (
                <p className="text-sm text-zinc-400">No student found with that name.</p>
              )}
              {query.trim().length >= 2 &&
                results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep({ name: "amount", to: r });
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10"
                  >
                    <span className="font-bold">{r.name}</span>
                    <span className="text-xs text-zinc-400">{r.university ?? "Not enrolled yet"}</span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {tab === "send" && step.name === "amount" && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-zinc-300">
              Sending to <span className="font-bold text-white">{step.to.name}</span>
            </p>
            <input
              className={input}
              inputMode="numeric"
              placeholder="Amount in naira, e.g. 5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input
              className={input}
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={80}
            />
            <button type="button" onClick={review} className={primary}>
              Review
            </button>
            <button type="button" onClick={restart} className="w-full py-2 text-sm text-zinc-400">
              Choose someone else
            </button>
          </div>
        )}

        {tab === "send" && step.name === "confirm" && (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-white/5 p-4 text-center">
              <p className="text-sm text-zinc-400">You are sending</p>
              <p className="mt-1 text-3xl font-black">{formatNaira(step.kobo)}</p>
              <p className="mt-1 text-sm">
                to <span className="font-bold">{step.to.name}</span>
              </p>
              {step.note && <p className="mt-2 text-sm italic text-zinc-400">“{step.note}”</p>}
              <p className="mt-3 text-xs text-zinc-500">
                Balance after: {formatNaira(balance - step.kobo)}. Transfers cannot be reversed.
              </p>
            </div>
            <button type="button" onClick={send} disabled={pending} className={primary}>
              {pending ? "Sending..." : "Send now"}
            </button>
            <button
              type="button"
              onClick={() => setStep({ name: "amount", to: step.to })}
              disabled={pending}
              className="w-full py-2 text-sm text-zinc-400"
            >
              Back
            </button>
          </div>
        )}

        {tab === "send" && step.name === "done" && (
          <div className="mt-6 text-center">
            <p className="text-5xl">✅</p>
            <p className="mt-3 text-lg font-extrabold">
              {formatNaira(step.kobo)} sent to {step.to.name}
            </p>
            <p className="mt-1 text-sm text-zinc-400">They have been notified.</p>
            <button type="button" onClick={restart} className={primary + " mt-5"}>
              Send more
            </button>
          </div>
        )}

        {tab === "history" && (
          <div className="mt-4 space-y-2">
            {history === null && <p className="text-sm text-zinc-400">Loading...</p>}
            {history?.length === 0 && <p className="text-sm text-zinc-400">No money movements yet.</p>}
            {history?.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{h.description}</p>
                  <p className="text-xs text-zinc-500">{timeAgo(h.created_at)}</p>
                </div>
                <p className={"font-bold " + (h.amount_kobo > 0 ? "text-emerald-300" : "text-zinc-200")}>
                  {h.amount_kobo > 0 ? "+" : "-"}
                  {formatNaira(Math.abs(h.amount_kobo))}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
