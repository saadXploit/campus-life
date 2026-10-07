"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { GameDynamic } from "@/lib/game/gameTypes";
import {
  REPORT_REASONS,
  bondLabel,
  lastSeenLabel,
  type ChatMessage,
  type ChatView,
  type SocialData,
  type SocialFriend,
} from "@/lib/game/social";
import { formatNaira } from "@/lib/money";
import {
  addToGroupAction,
  askOutAction,
  breakUpAction,
  createGroupAction,
  friendRequestAction,
  getMessagesAction,
  getSocialAction,
  leaveConversationAction,
  mutePlayerAction,
  openDirectAction,
  removeFriendAction,
  reportMessageAction,
  respondAskAction,
  respondFriendAction,
  sendGiftAction,
  sendMessageAction,
  setConversationMutedAction,
  setDatingAction,
} from "./chat-actions";
import { searchPlayersAction, type PlayerResult } from "./wallet-actions";

export type SocialStart = { tab?: "chats" | "friends" | "dating"; conversationId?: string; giftTo?: string };

const ASK_BOND = 25;

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" });
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short" });
}

// ---------- One chat ----------

function ChatScreen({
  conversationId,
  myId,
  friends,
  onBack,
  onChanged,
}: {
  conversationId: string;
  myId: string;
  friends: SocialFriend[];
  onBack: () => void;
  onChanged: () => void;
}) {
  const [view, setView] = useState<ChatView | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [reportFor, setReportFor] = useState<ChatMessage | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [, startTransition] = useTransition();
  const lastId = useRef<number | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    const r = await getMessagesAction(conversationId, lastId.current, null);
    if (!r.data) {
      if (r.error) setError(r.error);
      return;
    }
    const data = r.data;
    setView(data);
    if (data.messages.length) {
      lastId.current = data.messages[data.messages.length - 1].id;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...data.messages.filter((m) => !seen.has(m.id))].slice(-200);
      });
    }
  }, [conversationId]);

  useEffect(() => {
    let stop = false;
    const tick = () => {
      if (!stop && document.visibilityState === "visible") void poll();
    };
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 4000);
    return () => {
      stop = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [poll]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function send() {
    const body = text.trim();
    if (!body) return;
    setText("");
    setError(null);
    startTransition(async () => {
      const r = await sendMessageAction(conversationId, body);
      if (r.error) {
        setError(r.error);
        setText(body);
        return;
      }
      await poll();
      onChanged();
    });
  }

  const c = view?.conversation;
  const memberIds = new Set((c?.members ?? []).map((m) => m.id));

  return (
    <div className="flex h-[70dvh] flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
        <button type="button" onClick={onBack} className="text-sm text-zinc-400">
          ← Chats
        </button>
        <p className="min-w-0 flex-1 truncate text-center font-bold">
          {c?.kind === "campus" ? "🏫 " : c?.kind === "group" ? "👥 " : ""}
          {c?.title ?? "..."}
        </p>
        {c?.kind === "group" ? (
          <button type="button" onClick={() => setShowMembers((v) => !v)} className="text-sm text-zinc-400">
            Members
          </button>
        ) : (
          <span className="w-12" />
        )}
      </div>

      {showMembers && c?.kind === "group" && (
        <div className="mt-2 space-y-2 rounded-xl bg-white/5 p-3 text-sm">
          <p className="text-xs text-zinc-400">{(c.members ?? []).map((m) => m.name).join(", ")}</p>
          <div className="flex flex-wrap gap-2">
            {friends
              .filter((f) => !memberIds.has(f.id))
              .slice(0, 8)
              .map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await addToGroupAction(conversationId, f.id);
                      if (r.error) setError(r.error);
                      else await poll();
                    })
                  }
                  className="rounded-full border border-white/15 px-2 py-1 text-xs"
                >
                  + {f.name}
                </button>
              ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await setConversationMutedAction(conversationId, true);
                  onChanged();
                  setNotice("Chat muted. It will not count in your unread badge.");
                })
              }
              className="rounded-lg border border-white/15 px-3 py-1 text-xs"
            >
              🔕 Mute chat
            </button>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await leaveConversationAction(conversationId);
                  onChanged();
                  onBack();
                })
              }
              className="rounded-lg border border-red-500/40 px-3 py-1 text-xs text-red-300"
            >
              Leave group
            </button>
          </div>
        </div>
      )}

      {c?.kind === "campus" && (
        <p className="mt-2 text-center text-[11px] text-zinc-500">
          Everyone at your university can read this. Be kind; messages are kept for 7 days.
        </p>
      )}

      <div className="mt-2 flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 && <p className="mt-6 text-center text-sm text-zinc-500">No messages yet. Say hi!</p>}
        {messages.map((m) => (
          <div key={m.id} className={"flex " + (m.mine ? "justify-end" : "justify-start")}>
            <div className="max-w-[80%]">
              {!m.mine && c?.kind !== "direct" && <p className="mb-0.5 text-[11px] text-zinc-400">{m.sender}</p>}
              <div
                className={
                  "rounded-2xl px-3 py-2 text-sm " +
                  (m.mine ? "rounded-br-sm bg-amber-400 text-black" : "rounded-bl-sm bg-white/10 text-white")
                }
              >
                {m.body}
              </div>
              <div className={"mt-0.5 flex gap-2 text-[10px] text-zinc-500 " + (m.mine ? "justify-end" : "")}>
                <span>{timeLabel(m.at)}</span>
                {!m.mine && (
                  <button type="button" onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}>
                    ⋯
                  </button>
                )}
              </div>
              {menuFor === m.id && (
                <div className="mt-1 flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setReportFor(m);
                      setMenuFor(null);
                    }}
                    className="rounded-lg border border-white/15 px-2 py-1"
                  >
                    🚩 Report
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await mutePlayerAction(m.sender_id, true);
                        setMessages((prev) => prev.filter((x) => x.sender_id !== m.sender_id));
                        setMenuFor(null);
                        setNotice(`${m.sender} muted. You will not see their messages.`);
                      })
                    }
                    className="rounded-lg border border-white/15 px-2 py-1"
                  >
                    🔇 Mute {m.sender}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {reportFor && (
        <div className="mt-2 space-y-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm">
          <p>Report this message from {reportFor.sender}?</p>
          <p className="truncate text-xs italic text-zinc-400">“{reportFor.body}”</p>
          <select
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            className="w-full rounded-lg border border-white/15 bg-[#10172e] px-2 py-2 text-sm"
          >
            <option value="">Pick a reason</option>
            {REPORT_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!reportReason}
              onClick={() =>
                startTransition(async () => {
                  const r = await reportMessageAction(reportFor.id, reportReason, "");
                  setReportFor(null);
                  setReportReason("");
                  setNotice(r.error ?? "Thanks. Our moderators will look at it.");
                })
              }
              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold disabled:opacity-40"
            >
              Send report
            </button>
            <button type="button" onClick={() => setReportFor(null)} className="text-xs text-zinc-400">
              Cancel
            </button>
          </div>
        </div>
      )}

      {notice && <p className="mt-2 text-center text-xs text-emerald-300">{notice}</p>}
      {error && <p className="mt-2 text-center text-xs text-red-300">{error}</p>}

      {c?.closed ? (
        <p className="mt-3 rounded-xl bg-white/5 p-3 text-center text-sm text-zinc-400">
          You can no longer message in this chat.
        </p>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder="Type a message..."
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
          />
          <button type="submit" disabled={!text.trim()} className="rounded-xl bg-amber-400 px-4 font-bold text-black disabled:opacity-40">
            Send
          </button>
        </form>
      )}
      <p className="sr-only">{myId}</p>
    </div>
  );
}

// ---------- Sending a gift ----------

function GiftPicker({
  friend,
  data,
  onDone,
  onCancel,
}: {
  friend: SocialFriend;
  data: SocialData;
  onDone: (d: GameDynamic | null, msg: string) => void;
  onCancel: () => void;
}) {
  const [gift, setGift] = useState<string>("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const key = useRef(newKey());
  const chosen = data.gift_types.find((g) => g.slug === gift);

  return (
    <div className="space-y-3">
      <p className="font-bold">Send a gift to {friend.name}</p>
      <div className="grid grid-cols-3 gap-2">
        {data.gift_types.map((g) => (
          <button
            key={g.slug}
            type="button"
            onClick={() => setGift(g.slug)}
            className={
              "rounded-xl border p-2 text-center " +
              (gift === g.slug ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/5")
            }
          >
            <p className="text-2xl">{g.emoji}</p>
            <p className="text-xs font-semibold">{g.name}</p>
            <p className="text-[11px] text-emerald-300">{formatNaira(g.cost_kobo)}</p>
          </button>
        ))}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={80}
        placeholder="A short note (optional)"
        className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-amber-400"
      />
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!chosen || pending}
          onClick={() =>
            startTransition(async () => {
              const r = await sendGiftAction(friend.id, gift, note, key.current);
              if (r.error || !r.data) {
                setError(r.error ?? "That did not work.");
                return;
              }
              onDone(r.data, `${chosen?.emoji} ${chosen?.name} sent to ${friend.name}`);
            })
          }
          className="flex-1 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 font-extrabold text-black disabled:opacity-40"
        >
          {pending ? "Sending..." : chosen ? `Send for ${formatNaira(chosen.cost_kobo)}` : "Pick a gift"}
        </button>
        <button type="button" onClick={onCancel} className="px-3 text-sm text-zinc-400">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------- The panel ----------

export default function SocialPanel({
  myId,
  nowMs,
  start,
  onClose,
  onChanged,
  onDynamic,
}: {
  myId: string;
  nowMs: number;
  start: SocialStart;
  onClose: () => void;
  onChanged: () => void;
  onDynamic: (d: GameDynamic) => void;
}) {
  const [tab, setTab] = useState<"chats" | "friends" | "dating">(start.tab ?? "chats");
  const [data, setData] = useState<SocialData | null>(null);
  const [openConv, setOpenConv] = useState<string | null>(start.conversationId ?? null);
  const [giftTo, setGiftTo] = useState<string | null>(start.giftTo ?? null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [groupMode, setGroupMode] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupPick, setGroupPick] = useState<string[]>([]);
  const [adult, setAdult] = useState(false);
  const [breakupReason, setBreakupReason] = useState("");
  const [confirmBreakup, setConfirmBreakup] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const r = await getSocialAction();
    if (r.data) setData(r.data);
    else if (r.error) setError(r.error);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(async () => setResults(await searchPlayersAction(q)), 300);
    return () => clearTimeout(t);
  }, [query]);

  function act(fn: () => Promise<{ error?: string }>, ok?: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else if (ok) setNotice(ok);
      await load();
      onChanged();
    });
  }

  function message(friendId: string) {
    startTransition(async () => {
      const r = await openDirectAction(friendId);
      if (r.error || !r.data) {
        setError(r.error ?? "Could not open the chat.");
        return;
      }
      setTab("chats");
      setOpenConv(r.data);
    });
  }

  const friends = data?.friends ?? [];
  const giftFriend = friends.find((f) => f.id === giftTo) ?? null;
  const friendIds = new Set(friends.map((f) => f.id));
  const outIds = new Set((data?.requests_out ?? []).map((r) => r.id));

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#10172e] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-[0.2em] text-amber-300">SOCIAL</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl text-zinc-400">
            ✕
          </button>
        </div>

        {!openConv && !giftFriend && (
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1 text-sm font-semibold">
            {(["chats", "friends", "dating"] as const).map((t) => {
              const count =
                t === "chats"
                  ? (data?.conversations ?? []).filter((c) => !c.muted).reduce((n, c) => n + c.unread, 0)
                  : t === "friends"
                    ? (data?.requests_in.length ?? 0)
                    : (data?.asks_in.length ?? 0);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={"relative rounded-lg py-2 " + (tab === t ? "bg-white/15" : "text-zinc-400")}
                >
                  {t === "chats" ? "💬 Chats" : t === "friends" ? "👥 Friends" : "💘 Dating"}
                  {count > 0 && (
                    <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {error && <p className="mt-3 rounded-xl bg-red-500/15 p-2 text-center text-sm text-red-200">{error}</p>}
        {notice && <p className="mt-3 rounded-xl bg-emerald-500/10 p-2 text-center text-sm text-emerald-200">{notice}</p>}
        {!data && !error && <p className="mt-6 text-center text-sm text-zinc-400">Loading...</p>}

        {/* gift */}
        {data && giftFriend && (
          <div className="mt-4">
            <GiftPicker
              friend={giftFriend}
              data={data}
              onCancel={() => setGiftTo(null)}
              onDone={(d, msg) => {
                if (d) onDynamic(d);
                setGiftTo(null);
                setNotice(msg);
                void load();
              }}
            />
          </div>
        )}

        {/* a chat */}
        {data && openConv && !giftFriend && (
          <div className="mt-3">
            <ChatScreen
              conversationId={openConv}
              myId={myId}
              friends={friends}
              onBack={() => {
                setOpenConv(null);
                void load();
              }}
              onChanged={onChanged}
            />
          </div>
        )}

        {/* chats list */}
        {data && !openConv && !giftFriend && tab === "chats" && (
          <div className="mt-4 space-y-2">
            {data.conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setOpenConv(c.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10"
              >
                <span className="text-2xl">{c.kind === "campus" ? "🏫" : c.kind === "group" ? "👥" : "💬"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">
                    {c.title}
                    {c.muted && " 🔕"}
                  </span>
                  <span className="block truncate text-xs text-zinc-400">
                    {c.last ? `${c.last.sender}: ${c.last.body}` : "No messages yet"}
                  </span>
                </span>
                {c.unread > 0 && !c.muted && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold">{c.unread}</span>
                )}
              </button>
            ))}

            {!groupMode ? (
              <button
                type="button"
                onClick={() => setGroupMode(true)}
                disabled={friends.length === 0}
                className="w-full rounded-2xl border border-dashed border-white/20 py-3 text-sm text-zinc-300 disabled:opacity-40"
              >
                + New group chat {friends.length === 0 && "(add friends first)"}
              </button>
            ) : (
              <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                <input
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  maxLength={40}
                  placeholder="Group name, e.g. CSC 100L squad"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-amber-400"
                />
                <div className="flex flex-wrap gap-2">
                  {friends.map((f) => {
                    const on = groupPick.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setGroupPick((p) => (on ? p.filter((x) => x !== f.id) : [...p, f.id]))}
                        className={
                          "rounded-full border px-3 py-1 text-xs " +
                          (on ? "border-amber-400 bg-amber-400/15" : "border-white/15")
                        }
                      >
                        {on ? "✓ " : ""}
                        {f.name}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending || groupPick.length === 0 || groupTitle.trim().length < 2}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await createGroupAction(groupTitle, groupPick);
                        if (r.error || !r.data) {
                          setError(r.error ?? "Could not create the group.");
                          return;
                        }
                        setGroupMode(false);
                        setGroupTitle("");
                        setGroupPick([]);
                        setOpenConv(r.data);
                      })
                    }
                    className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-40"
                  >
                    Create
                  </button>
                  <button type="button" onClick={() => setGroupMode(false)} className="text-sm text-zinc-400">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* friends */}
        {data && !openConv && !giftFriend && tab === "friends" && (
          <div className="mt-4 space-y-4">
            {data.requests_in.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-400">FRIEND REQUESTS</p>
                {data.requests_in.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl bg-amber-400/10 p-3">
                    <span className="font-bold">{r.name}</span>
                    <span className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => act(() => respondFriendAction(r.id, true), `You and ${r.name} are now friends`)}
                        className="rounded-lg bg-amber-400 px-3 py-1 text-xs font-bold text-black"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => act(() => respondFriendAction(r.id, false))}
                        className="rounded-lg border border-white/15 px-3 py-1 text-xs"
                      >
                        Decline
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={20}
                placeholder="🔎 Find a student to add"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
              />
              {query.trim().length >= 2 && (
                <div className="mt-2 space-y-1">
                  {results.length === 0 && <p className="text-xs text-zinc-500">No student found.</p>}
                  {results.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm">
                      <span>
                        <span className="font-bold">{p.name}</span>{" "}
                        <span className="text-xs text-zinc-400">{p.university ?? ""}</span>
                      </span>
                      {friendIds.has(p.id) ? (
                        <span className="text-xs text-emerald-300">Friends</span>
                      ) : outIds.has(p.id) ? (
                        <span className="text-xs text-zinc-400">Requested</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => act(() => friendRequestAction(p.id), `Friend request sent to ${p.name}`)}
                          className="rounded-lg bg-amber-400 px-3 py-1 text-xs font-bold text-black"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-400">FRIENDS ({friends.length})</p>
              {friends.length === 0 && (
                <p className="text-sm text-zinc-500">No friends yet. Add someone above, or tap a student on campus.</p>
              )}
              {friends.map((f) => (
                <div key={f.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold">
                        <span className={f.online ? "text-emerald-400" : "text-zinc-600"}>●</span> {f.name}
                        {f.partner && " 💞"}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {lastSeenLabel(f.online, f.last_seen, nowMs)}
                        {f.online && f.place ? ` · at ${f.place}` : ""} · {bondLabel(f.bond)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => message(f.id)} className="rounded-lg bg-white/10 px-2 py-1 text-sm" aria-label={`Message ${f.name}`}>
                        💬
                      </button>
                      <button type="button" onClick={() => setGiftTo(f.id)} className="rounded-lg bg-white/10 px-2 py-1 text-sm" aria-label={`Gift ${f.name}`}>
                        🎁
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Unfriend ${f.name}?`)) act(() => removeFriendAction(f.id));
                        }}
                        className="rounded-lg bg-white/10 px-2 py-1 text-xs text-zinc-400"
                      >
                        Unfriend
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {data.requests_out.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-400">SENT REQUESTS</p>
                {data.requests_out.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span>{r.name}</span>
                    <button type="button" onClick={() => act(() => removeFriendAction(r.id))} className="text-xs text-zinc-400 underline">
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}

            {data.muted.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-400">MUTED</p>
                {data.muted.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <span>{m.name}</span>
                    <button type="button" onClick={() => act(() => mutePlayerAction(m.id, false))} className="text-xs text-zinc-400 underline">
                      Unmute
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* dating */}
        {data && !openConv && !giftFriend && tab === "dating" && (
          <div className="mt-4 space-y-4">
            {!data.me.dating_opt_in ? (
              <div className="rounded-2xl border border-pink-400/30 bg-pink-400/5 p-4">
                <p className="text-lg font-extrabold">💘 Dating on campus</p>
                <p className="mt-1 text-sm text-zinc-300">
                  Ask out a friend you are close to. It only starts if they say yes, you can only date one person
                  at a time, and you can end it any time. Keep it respectful: anything sexual or harassing gets
                  accounts banned.
                </p>
                {data.me.age < 18 ? (
                  <p className="mt-3 text-sm text-amber-300">Dating is only for students aged 18 and over.</p>
                ) : (
                  <>
                    <label className="mt-3 flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />I confirm I am 18
                      or older in real life.
                    </label>
                    <button
                      type="button"
                      disabled={!adult || pending}
                      onClick={() => act(() => setDatingAction(true, true), "Dating turned on")}
                      className="mt-3 w-full rounded-2xl bg-pink-500 py-3 font-bold disabled:opacity-40"
                    >
                      Turn on dating
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {data.partner ? (
                  <div className="rounded-2xl border border-pink-400/40 bg-pink-500/10 p-4 text-center">
                    <p className="text-3xl">💞</p>
                    <p className="mt-1 text-lg font-extrabold">You are dating {data.partner.name}</p>
                    <p className="text-xs text-zinc-400">Since {dateLabel(data.partner.since)}</p>
                    <div className="mt-3 flex justify-center gap-2">
                      <button type="button" onClick={() => data.partner && message(data.partner.id)} className="rounded-xl bg-white/10 px-4 py-2 text-sm">
                        💬 Message
                      </button>
                      <button type="button" onClick={() => data.partner && setGiftTo(data.partner.id)} className="rounded-xl bg-white/10 px-4 py-2 text-sm">
                        🎁 Gift
                      </button>
                    </div>
                    {!confirmBreakup ? (
                      <button type="button" onClick={() => setConfirmBreakup(true)} className="mt-3 text-xs text-zinc-400 underline">
                        Break up
                      </button>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <input
                          value={breakupReason}
                          onChange={(e) => setBreakupReason(e.target.value)}
                          maxLength={120}
                          placeholder="Reason (optional)"
                          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmBreakup(false);
                            act(() => breakUpAction(breakupReason), "It is over. Take care of yourself.");
                          }}
                          className="w-full rounded-xl bg-red-500/80 py-2 text-sm font-bold"
                        >
                          💔 Break up with {data.partner.name}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="rounded-xl bg-white/5 p-3 text-sm text-zinc-300">You are single.</p>
                )}

                {data.asks_in.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-xl bg-pink-500/10 p-3">
                    <span>
                      <span className="font-bold">{a.name}</span> asked you out 💘
                    </span>
                    <span className="flex gap-2">
                      <button type="button" onClick={() => act(() => respondAskAction(a.id, true), `You are now dating ${a.name} 💞`)} className="rounded-lg bg-pink-500 px-3 py-1 text-xs font-bold">
                        Yes
                      </button>
                      <button type="button" onClick={() => act(() => respondAskAction(a.id, false))} className="rounded-lg border border-white/15 px-3 py-1 text-xs">
                        No
                      </button>
                    </span>
                  </div>
                ))}

                {data.asks_out.map((a) => (
                  <p key={a.id} className="text-sm text-zinc-400">
                    Waiting for {a.name} to answer...
                  </p>
                ))}

                {!data.partner && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-zinc-400">FRIENDS YOU COULD ASK OUT</p>
                    {friends.filter((f) => f.dating_opt_in).length === 0 && (
                      <p className="text-sm text-zinc-500">None of your friends have turned on dating yet.</p>
                    )}
                    {friends
                      .filter((f) => f.dating_opt_in)
                      .map((f) => (
                        <div key={f.id} className="flex items-center justify-between rounded-xl bg-white/5 p-3 text-sm">
                          <span>
                            <span className="font-bold">{f.name}</span>{" "}
                            <span className="text-xs text-zinc-400">· {bondLabel(f.bond)}</span>
                          </span>
                          {f.bond >= ASK_BOND ? (
                            <button
                              type="button"
                              onClick={() => act(() => askOutAction(f.id), `You asked ${f.name} out. Fingers crossed!`)}
                              className="rounded-lg bg-pink-500 px-3 py-1 text-xs font-bold"
                            >
                              Ask out 💘
                            </button>
                          ) : (
                            <span className="text-[11px] text-zinc-500">Get closer first</span>
                          )}
                        </div>
                      ))}
                  </div>
                )}

                {data.history.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-zinc-400">PAST RELATIONSHIPS</p>
                    {data.history.map((h, i) => (
                      <p key={i} className="text-sm text-zinc-400">
                        {h.name} · {dateLabel(h.started_at)} → {dateLabel(h.ended_at)}
                      </p>
                    ))}
                  </div>
                )}

                {!data.partner && (
                  <button type="button" onClick={() => act(() => setDatingAction(false, false), "Dating turned off")} className="text-xs text-zinc-500 underline">
                    Turn off dating
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
