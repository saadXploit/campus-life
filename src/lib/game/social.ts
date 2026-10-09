/** How two players feel about each other, from -100 (enemies) to 100 (close friends). */
export function bondLabel(bond: number): string {
  if (bond >= 70) return "Close friend";
  if (bond >= 40) return "Friend";
  if (bond >= 10) return "Mate";
  if (bond > -10) return "Stranger";
  if (bond > -40) return "Rival";
  return "Enemy";
}

export const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hate or insults about who someone is" },
  { value: "inappropriate", label: "Sexual or inappropriate" },
  { value: "spam", label: "Spam or scams" },
  { value: "cheating", label: "Cheating or exploiting" },
  { value: "other", label: "Something else" },
] as const;

// ---------- Friends, chats and dating (shapes returned by the database) ----------

export type SocialFriend = {
  id: string;
  name: string;
  skin: number;
  hair_style: number;
  hair_color: number;
  outfit: number;
  online: boolean;
  last_seen: string | null;
  place: string | null;
  bond: number;
  dating_opt_in: boolean;
  partner: boolean;
};

export type ConversationSummary = {
  id: string;
  kind: "direct" | "group" | "campus";
  title: string | null;
  muted: boolean;
  last: { body: string; sender: string; at: string } | null;
  unread: number;
};

export type GiftType = { slug: string; name: string; emoji: string; cost_kobo: number; romantic: boolean };

export type SocialData = {
  me: { id: string; age: number; dating_opt_in: boolean };
  friends: SocialFriend[];
  requests_in: { id: string; name: string; at: string }[];
  requests_out: { id: string; name: string }[];
  conversations: ConversationSummary[];
  partner: { id: string; name: string; since: string } | null;
  asks_in: { id: string; name: string; at: string }[];
  asks_out: { id: string; name: string }[];
  history: { name: string; started_at: string; ended_at: string }[];
  gift_types: GiftType[];
  muted: { id: string; name: string }[];
};

export type ChatMessage = { id: number; sender_id: string; sender: string; body: string; at: string; mine: boolean };

export type ChatView = {
  conversation: {
    id: string;
    kind: "direct" | "group" | "campus";
    title: string | null;
    closed: boolean;
    members: { id: string; name: string; role: string }[] | null;
  };
  messages: ChatMessage[];
};

export type SocialBadges = {
  unread_chats: number;
  friend_requests: number;
  dating_asks: number;
  friend_ids: string[];
  pending_ids: string[];
  /** Invitations from friends to eat, play or hang out together. */
  outings?: OutingInvite[];
  /** Friends offering you a lift in their car. */
  rides?: RideOffer[];
};

export type RideOffer = {
  id: string;
  driver_id: string;
  driver: string;
  car: string;
  place: string;
  place_kind: string;
  expires_at: string;
};

export type OutingInvite = {
  id: string;
  host_id: string;
  host: string;
  activity: string;
  activity_slug: string;
  cost_kobo: number;
  place: string;
  place_kind: string;
  host_pays: boolean;
  expires_at: string;
};

/** "online", "5m ago", "3h ago", "2d ago". */
export function lastSeenLabel(online: boolean, iso: string | null, nowMs: number): string {
  if (online) return "online";
  if (!iso) return "offline";
  const s = Math.max(0, (nowMs - Date.parse(iso)) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** A "people you may know" suggestion. */
export type Suggestion = {
  id: string;
  name: string;
  skin: number;
  hair_style: number;
  hair_color: number;
  outfit: number;
  level_year: number;
  course: string;
  reason: string;
};

export type Suggestions = { discoverable: boolean; suggestions: Suggestion[] };
