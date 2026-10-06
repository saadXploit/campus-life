import { z } from "zod";

export const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9 ._-]{2,19}$/;

export const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "nonbinary", label: "Non-binary" },
] as const;

export const INTERESTS = [
  { value: "science", label: "Science and Tech", icon: "🔬" },
  { value: "engineering", label: "Engineering", icon: "⚙️" },
  { value: "health", label: "Health and Medicine", icon: "🩺" },
  { value: "social", label: "Social Sciences and Media", icon: "🎙️" },
  { value: "arts", label: "Arts and Creativity", icon: "🎭" },
  { value: "law", label: "Law", icon: "⚖️" },
  { value: "management", label: "Business and Management", icon: "📊" },
] as const;

export const SKIN_TONES = ["#e9c4a0", "#c99468", "#a8693f", "#85502c", "#5f3a20", "#3f2514"];
export const HAIR_COLORS = ["#111111", "#2b1b12", "#5a3825", "#7a1f1f", "#c9a227", "#6b7280"];
export const HAIR_STYLE_NAMES = ["Low crop", "Afro", "Braids", "Puffs", "Long", "Fade"];

export const OUTFITS = [
  { name: "Red tee", color: "#ef4444" },
  { name: "Blue tee", color: "#3b82f6" },
  { name: "Green tee", color: "#10b981" },
  { name: "Orange tee", color: "#f59e0b" },
  { name: "Purple tee", color: "#8b5cf6" },
  { name: "White tee", color: "#e5e7eb" },
];
export const OUTFIT_COLORS = OUTFITS.map((o) => o.color);

const pick = z.coerce.number().int().min(0).max(5);

/** The same rules run in the browser (for friendly hints) and on the server (the real check). */
export const characterSchema = z.object({
  displayName: z
    .string()
    .trim()
    .regex(
      NAME_PATTERN,
      "Choose a name of 3 to 20 characters. Start with a letter; use letters, numbers, spaces, dots, dashes or underscores."
    )
    .refine((v) => !/\s{2,}/.test(v), "Please avoid double spaces in your name."),
  age: z.coerce
    .number()
    .int()
    .min(16, "Age must be between 16 and 30.")
    .max(30, "Age must be between 16 and 30."),
  gender: z.enum(["female", "male", "nonbinary"], { message: "Pick a gender option." }),
  skin: pick,
  hairStyle: pick,
  hairColor: pick,
  outfit: pick,
  background: z.string().regex(/^[a-z-]{2,40}$/, "Please pick a background."),
  interest: z.enum(
    ["science", "engineering", "health", "social", "arts", "law", "management"],
    { message: "Please pick what you want to study." }
  ),
});