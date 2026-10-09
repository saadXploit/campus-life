"use server";

import { z } from "zod";
import { requirePlayerId } from "@/lib/auth/guards";
import type { GameDynamic } from "@/lib/game/gameTypes";
import type { ChatView, SocialBadges, SocialData, Suggestions } from "@/lib/game/social";
import { createAdminClient } from "@/lib/supabase/admin";

// Friends, chats, dating and gifts. Each action is one database call that checks
// the account, friendship, blocks, consent and rate limits.

const ERRORS: Record<string, string> = {
  "not friends": "You need to be friends for that.",
  "not a member": "You are not in that chat.",
  "bad message": "Messages must be 1 to 500 characters.",
  "bad title": "Group names must be 2 to 40 characters.",
  "pick 1 to 29 friends": "Pick between 1 and 29 friends.",
  "group full": "That group is full (30 people).",
  "too many friends": "You have reached the friend limit.",
  "too many requests today": "You have sent a lot of friend requests today. Try again tomorrow.",
  "unknown player": "That student could not be found.",
  "no request": "That request is no longer there.",
  "dating off": "Turn on dating first.",
  "they are not dating": "They have not turned on dating.",
  "not close enough": "Get closer first: hang out, chat and do things together.",
  "already dating": "You are already in a relationship.",
  "they are taken": "They are already in a relationship.",
  "too soon": "Give it a few days before asking again.",
  "already asked": "You already asked. Wait for their answer.",
  "not dating": "You are not in a relationship.",
  "break up first": "End your relationship before turning dating off.",
  "character too young": "Your student must be 18 or older to date.",
  "confirm adult": "Please confirm you are 18 or older.",
  "not enough money": "You cannot afford that gift.",
  "unknown gift": "That gift does not exist.",
  "unknown message": "That message cannot be reported.",
  "slow down": "Slow down a little.",
  "not yourself": "You cannot do that to yourself.",
  blocked: "This account cannot play right now.",
};

function friendly(fn: string, message: string): string {
  const known = Object.keys(ERRORS).find((k) => message.includes(k));
  if (known) return ERRORS[known];
  console.error(`${fn} failed:`, message);
  return "Something went wrong. Please try again.";
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<{ data?: T; error?: string }> {
  const userId = await requirePlayerId();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc(fn, { p_user_id: userId, ...args });
  if (error) return { error: friendly(fn, error.message) };
  return { data: data as T };
}

const uuid = z.string().uuid();
const bad: { data?: undefined; error: string } = { error: "That is not possible." };

export async function getSocialAction() {
  return rpc<SocialData>("get_social", {});
}

export async function badgesAction(): Promise<SocialBadges | null> {
  const r = await rpc<SocialBadges>("social_badges", {});
  return r.data ?? null;
}

export async function friendRequestAction(targetId: string) {
  if (!uuid.safeParse(targetId).success) return bad;
  return rpc<string>("friend_request", { p_target: targetId });
}

export async function respondFriendAction(fromId: string, accept: boolean) {
  if (!uuid.safeParse(fromId).success) return bad;
  return rpc<null>("respond_friend", { p_from: fromId, p_accept: accept });
}

export async function removeFriendAction(targetId: string) {
  if (!uuid.safeParse(targetId).success) return bad;
  return rpc<null>("remove_friend", { p_target: targetId });
}

export async function mutePlayerAction(targetId: string, mute: boolean) {
  if (!uuid.safeParse(targetId).success) return bad;
  return rpc<null>("mute_player", { p_target: targetId, p_mute: mute });
}

export async function openDirectAction(friendId: string) {
  if (!uuid.safeParse(friendId).success) return bad;
  return rpc<string>("open_direct", { p_friend: friendId });
}

export async function createGroupAction(title: string, memberIds: string[]) {
  const t = z.string().trim().min(2).max(40).safeParse(title);
  const m = z.array(z.string().uuid()).min(1).max(29).safeParse(memberIds);
  if (!t.success) return { error: ERRORS["bad title"] };
  if (!m.success) return { error: ERRORS["pick 1 to 29 friends"] };
  return rpc<string>("create_group", { p_title: t.data, p_members: m.data });
}

export async function addToGroupAction(conversationId: string, friendId: string) {
  if (!uuid.safeParse(conversationId).success || !uuid.safeParse(friendId).success) return bad;
  return rpc<null>("add_to_group", { p_conversation: conversationId, p_friend: friendId });
}

export async function leaveConversationAction(conversationId: string) {
  if (!uuid.safeParse(conversationId).success) return bad;
  return rpc<null>("leave_conversation", { p_conversation: conversationId });
}

export async function setConversationMutedAction(conversationId: string, muted: boolean) {
  if (!uuid.safeParse(conversationId).success) return bad;
  return rpc<null>("set_conversation_muted", { p_conversation: conversationId, p_muted: muted });
}

export async function sendMessageAction(conversationId: string, body: string) {
  const b = z.string().trim().min(1).max(500).safeParse(body);
  if (!uuid.safeParse(conversationId).success) return bad;
  if (!b.success) return { error: ERRORS["bad message"] };
  return rpc<{ id: number; at: string }>("send_message", { p_conversation: conversationId, p_body: b.data });
}

export async function getMessagesAction(conversationId: string, after: number | null, before: number | null) {
  if (!uuid.safeParse(conversationId).success) return bad;
  const n = z.number().int().positive().nullable();
  if (!n.safeParse(after).success || !n.safeParse(before).success) return bad;
  return rpc<ChatView>("get_messages", { p_conversation: conversationId, p_after: after, p_before: before });
}

export async function setDatingAction(on: boolean, confirmAdult: boolean) {
  return rpc<null>("set_dating", { p_on: on, p_confirm_adult: confirmAdult });
}

export async function askOutAction(targetId: string) {
  if (!uuid.safeParse(targetId).success) return bad;
  return rpc<null>("ask_out", { p_target: targetId });
}

export async function respondAskAction(fromId: string, accept: boolean) {
  if (!uuid.safeParse(fromId).success) return bad;
  return rpc<null>("respond_ask", { p_from: fromId, p_accept: accept });
}

export async function breakUpAction(reason: string) {
  const r = z.string().trim().max(120).safeParse(reason);
  return rpc<null>("break_up", { p_reason: r.success ? r.data : "" });
}

export async function sendGiftAction(targetId: string, gift: string, note: string, key: string) {
  if (!uuid.safeParse(targetId).success) return bad;
  if (!/^[a-z_]{2,30}$/.test(gift) || !/^[A-Za-z0-9-]{8,64}$/.test(key)) return bad;
  const n = z.string().trim().max(80).safeParse(note);
  return rpc<GameDynamic & { duplicate: boolean }>("send_gift", {
    p_target: targetId,
    p_gift: gift,
    p_note: n.success ? n.data : "",
    p_key: key,
  });
}

const reasons = z.enum(["harassment", "hate", "spam", "cheating", "inappropriate", "other"]);

export async function reportMessageAction(messageId: number, reason: string, details: string) {
  const r = reasons.safeParse(reason);
  if (!z.number().int().positive().safeParse(messageId).success || !r.success) return { error: "Please pick a reason." };
  return rpc<number>("report_message", { p_message: messageId, p_reason: r.data, p_details: details.slice(0, 300) });
}

/** People you may know (up to 10, each with a reason). */
export async function suggestionsAction() {
  return rpc<Suggestions>("get_suggestions", {});
}

export async function dismissSuggestionAction(targetId: string) {
  if (!uuid.safeParse(targetId).success) return bad;
  return rpc<null>("dismiss_suggestion", { p_target: targetId });
}

export async function setDiscoverableAction(on: boolean) {
  return rpc<boolean>("set_discoverable", { p_on: on === true });
}
