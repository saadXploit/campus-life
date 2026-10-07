/**
 * Building interiors: room size and where each activity happens inside.
 * Pure data, shared by any client that draws the rooms.
 * Room origin is the floor centre. The back wall is at -z, the open (camera) side at +z.
 */

export type Pose = "idle" | "walk" | "busy" | "sit" | "exercise" | "dance" | "sleep";

export type Spot = { x: number; y: number; z: number; heading: number; pose: Pose };

export const ROOM = { w: 10, d: 8, h: 3.6 };

/** Where the player stands after walking in, facing the camera. */
export const ENTRY_SPOT: Spot = { x: 0, y: 0, z: 2.6, heading: 0, pose: "idle" };

/** Places with a room you walk into. The sports field and market stay outdoors. */
export const INTERIOR_KINDS = ["hostel", "faculty", "library", "cafeteria", "clubhouse", "health"];

export function hasInterior(kind: string | null): boolean {
  return kind !== null && INTERIOR_KINDS.includes(kind);
}

// Your bunk: the lower bed on the left. Lying down, the head points to the back wall.
export const BED_SPOT: Spot = { x: -3.8, y: 0.55, z: -0.5, heading: 0, pose: "sleep" };

export const ACTIVITY_SPOTS: Record<string, Spot> = {
  sleep: BED_SPOT,
  nap: BED_SPOT,
  bread_and_tea: { x: 0, y: 0, z: -2.3, heading: Math.PI, pose: "sit" },
  hang_out_hostel: { x: 0.8, y: 0, z: 0.4, heading: -0.4, pose: "dance" },
  cafeteria_meal: { x: -2, y: 0, z: 0.9, heading: Math.PI, pose: "sit" },
  quiet_reading: { x: 1.5, y: 0, z: 0.9, heading: Math.PI, pose: "sit" },
  faculty_gist: { x: 2.6, y: 0, z: 1.6, heading: -0.6, pose: "busy" },
  clubhouse_hangout: { x: 0, y: 0.08, z: 0.2, heading: 0, pose: "dance" },
  health_checkup: { x: -2.6, y: 0.27, z: -0.6, heading: 0.5, pose: "sit" },
};

/** Where an activity happens. Unknown activities play in the middle of the room. */
export function spotFor(slug: string, fallback: Pose): Spot {
  return ACTIVITY_SPOTS[slug] ?? { x: 0, y: 0, z: 0.5, heading: 0, pose: fallback };
}
