export type Hotspot = {
  id: string;
  label: string;
  /** Position and size as a percentage of the scene picture. */
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
};

export type Slot = {
  /** Where the character's feet are, as a percentage of the picture. */
  x: number;
  y: number;
  /** Character height as a fraction of the picture height. */
  height: number;
};

export type SceneConfig = {
  kind: string;
  title: string;
  images: { day: string; evening: string; night: string };
  stage: Slot[];
  hotspots: Hotspot[];
};

export type TimeSlot = "day" | "evening" | "night";

export function timeSlot(hour: number): TimeSlot {
  if (hour >= 20) return "night";
  if (hour >= 16) return "evening";
  return "day";
}

// Hotspot positions are first guesses. We tune them against the real picture.
export const SCENES: Record<string, SceneConfig> = {
  hostel: {
    kind: "hostel",
    title: "Your hostel room",
    images: {
      day: "/scenes/hostel/day.webp",
      evening: "/scenes/hostel/evening.webp",
      night: "/scenes/hostel/night.webp",
    },
    stage: [{ x: 50, y: 90, height: 0.4 }],
    hotspots: [
      {
        id: "bed",
        label: "Bed",
        x: 4,
        y: 42,
        w: 38,
        h: 26,
        text: "Going to bed ends your day and restores your energy.",
      },
      {
        id: "desk",
        label: "Desk",
        x: 52,
        y: 46,
        w: 40,
        h: 22,
        text: "Study, work and side hustles will happen here once academics and money systems arrive.",
      },
      {
        id: "wardrobe",
        label: "Wardrobe",
        x: 72,
        y: 18,
        w: 24,
        h: 26,
        text: "Your clothes and items will live here.",
      },
      {
        id: "window",
        label: "Window",
        x: 30,
        y: 8,
        w: 36,
        h: 20,
        text: "The light outside follows the time of day on your campus.",
      },
    ],
  },
};