/** Shapes returned by the game database functions (get_game_state and the actions). */

import type { GameJob, PlayerJob } from "./jobs";
import type { ItemInfo } from "./shop";

export type GameLocation = {
  id: string;
  name: string;
  kind: string;
  description: string;
  map_x: number;
  map_y: number;
  has_billboard: boolean;
};

export type GameActivity = {
  slug: string;
  name: string;
  description: string;
  location_kind: string;
  duration_minutes: number;
  energy_delta: number;
  health_delta: number;
  happiness_delta: number;
  cost_kobo: number;
  ends_day: boolean;
  cooldown_minutes: number;
};

export type GameInteraction = {
  slug: string;
  name: string;
  /** "raised a glass with", for the activity log. */
  verb: string;
  emoji: string;
  pose: "talk" | "toast" | "dance" | "fight" | "busy" | "exercise";
  place_kinds: string[];
  energy_cost: number;
  cost_kobo: number;
  bond_delta: number;
};

/** A live sponsored placement. The link is only handed out when someone clicks. */
export type GameAd = {
  id: string;
  placement: "billboard" | "club_song" | "market_product";
  advertiser: string;
  headline: string;
  subline: string | null;
  price_text: string | null;
  bg_color: string;
  fg_color: string;
  has_link: boolean;
  weight: number;
};

/** Another real player who is online at your university. */
export type Person = {
  id: string;
  name: string;
  skin: number;
  hair_style: number;
  hair_color: number;
  outfit: number;
  location_kind: string;
  /** Which room of that place they are in (busy places split into rooms). */
  room: number;
  /** In the same place and the same room as you. */
  same_room: boolean;
  friend: boolean;
  asleep: boolean;
  activity: string | null;
  bond: number;
  /** Shop items they wear and drive (slot to item slug). */
  style?: Record<string, string>;
};

/** Something that happened where you are: a chat line or an interaction. */
export type PlaceEvent = {
  id: number;
  kind: string;
  body: string | null;
  actor_id: string;
  actor: string;
  target_id: string | null;
  target: string | null;
  at: string;
};

export type WorldSnapshot = {
  people: Person[];
  /** Everyone online on campus, people at your place, and how many rooms it has split into. */
  counts: { online: number; here: number; rooms_here: number };
  room: number;
  events: PlaceEvent[];
  location_kind: string | null;
  server_time: string;
};

/** The part that changes while playing. Every action returns a fresh copy. */
export type GameDynamic = {
  state: {
    energy: number;
    health: number;
    happiness: number;
    location_kind: string | null;
    asleep_since: string | null;
    busy_until: string | null;
    busy_activity: string | null;
    /** Your room at this place (your hostel room number at home). */
    room?: number;
    share_location?: boolean;
  };
  balance_kobo: number;
  unread: number;
  cooldowns: Record<string, string>;
  /** Your job, or null if you have never had one. */
  job?: PlayerJob | null;
  server_time: string;
};

export type GameState = GameDynamic & {
  status: "ok";
  player: {
    id: string;
    name: string;
    age?: number;
    skin: number;
    hair_style: number;
    hair_color: number;
    outfit: number;
    /** Shop items you wear and drive (slot to item slug). */
    style?: Record<string, string>;
    /** Hostel room upgrades you own ("ac", "speaker"...). */
    room_items?: string[];
  };
  enrollment: {
    level_year: number;
    course: string;
    department: string;
    faculty: string;
    university: { name: string; short_name: string; primary_color: string; secondary_color: string };
  };
  /** Every faculty on this campus (each is drawn as its own building). */
  faculties: string[];
  locations: GameLocation[];
  activities: GameActivity[];
  interactions: GameInteraction[];
  /** Jobs on campus (each boss is a staff character). */
  jobs?: GameJob[];
  /** How every wearable shop item and car looks. */
  items?: ItemInfo[];
  ads: GameAd[];
};

export type GameStateResult = GameState | { status: "no_player" | "not_enrolled" | "blocked" };
