/** Shapes returned by the game database functions (get_game_state and the actions). */

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
  };
  balance_kobo: number;
  unread: number;
  cooldowns: Record<string, string>;
  server_time: string;
};

export type GameState = GameDynamic & {
  status: "ok";
  player: {
    id: string;
    name: string;
    skin: number;
    hair_style: number;
    hair_color: number;
    outfit: number;
  };
  enrollment: {
    level_year: number;
    course: string;
    university: { name: string; short_name: string; primary_color: string; secondary_color: string };
  };
  locations: GameLocation[];
  activities: GameActivity[];
};

export type GameStateResult = GameState | { status: "no_player" | "not_enrolled" | "blocked" };
