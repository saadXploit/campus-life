"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Avatar from "@/components/Avatar";
import {
  GENDERS,
  HAIR_COLORS,
  HAIR_STYLE_NAMES,
  INTERESTS,
  NAME_PATTERN,
  OUTFITS,
  SKIN_TONES,
} from "@/lib/game/options";
import { formatNaira } from "@/lib/money";
import { createCharacterAction } from "./actions";

export type BackgroundOption = {
  slug: string;
  name: string;
  blurb: string;
  starting_wallet_kobo: number;
  academic_bonus: number;
  hustle_bonus: number;
  social_bonus: number;
};

const STEPS = ["You", "Look", "Story", "Passion", "Review"];

function Dots({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-xs text-zinc-400">
      <span>{label}</span>
      <span className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={"h-2 w-2 rounded-full " + (i < value ? "bg-amber-400" : "bg-white/15")}
          />
        ))}
      </span>
    </div>
  );
}

const chip = (active: boolean) =>
  "rounded-xl border px-3 py-3 text-sm font-semibold transition active:scale-95 " +
  (active
    ? "border-amber-400 bg-amber-400/15 text-amber-200"
    : "border-white/10 bg-white/5 text-zinc-300");

export default function CharacterCreator({ backgrounds }: { backgrounds: BackgroundOption[] }) {
  const [state, formAction, pending] = useActionState(createCharacterAction, null);

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState(18);
  const [gender, setGender] = useState("female");
  const [skin, setSkin] = useState(3);
  const [hairStyle, setHairStyle] = useState(0);
  const [hairColor, setHairColor] = useState(0);
  const [outfit, setOutfit] = useState(0);
  const [background, setBackground] = useState("");
  const [interest, setInterest] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  const name = displayName.trim();
  const nameOk = NAME_PATTERN.test(name) && !/\s{2,}/.test(name);
  const chosenBackground = backgrounds.find((b) => b.slug === background);
  const chosenInterest = INTERESTS.find((i) => i.value === interest);

  function next() {
    if (step === 0 && !nameOk) {
      setHint(
        "Choose a name of 3 to 20 characters. Start with a letter; use letters, numbers, spaces, dots, dashes or underscores."
      );
      return;
    }
    if (step === 2 && !background) {
      setHint("Pick the story you are starting with.");
      return;
    }
    if (step === 3 && !interest) {
      setHint("Pick what you want to study.");
      return;
    }
    setHint(null);
    setStep((s) => Math.min(4, s + 1));
  }

  function back() {
    setHint(null);
    setStep((s) => Math.max(0, s - 1));
  }

  const preview = (
    <Avatar
      skin={skin}
      hairStyle={hairStyle}
      hairColor={hairColor}
      outfit={outfit}
      className="mx-auto h-44 w-44 rounded-3xl bg-gradient-to-b from-white/10 to-white/0"
    />
  );

  return (
    <main className="min-h-screen bg-[#0b1020] px-4 pb-32 pt-6 text-white">
      <div className="mx-auto max-w-md">
        <p className="text-center text-xs font-semibold tracking-[0.3em] text-amber-400">
          CAMPUS LIFE
        </p>
        <div className="mt-3 flex gap-1">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={"h-1.5 flex-1 rounded-full " + (i <= step ? "bg-amber-400" : "bg-white/10")}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Step {step + 1} of 5 · {STEPS[step]}
        </p>

        <form action={formAction}>
          <input type="hidden" name="displayName" value={name} />
          <input type="hidden" name="age" value={age} />
          <input type="hidden" name="gender" value={gender} />
          <input type="hidden" name="skin" value={skin} />
          <input type="hidden" name="hairStyle" value={hairStyle} />
          <input type="hidden" name="hairColor" value={hairColor} />
          <input type="hidden" name="outfit" value={outfit} />
          <input type="hidden" name="background" value={background} />
          <input type="hidden" name="interest" value={interest} />

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="mt-6"
            >
              {step === 0 && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-extrabold">Who are you?</h1>
                    <p className="mt-1 text-sm text-zinc-400">
                      This is your student, a character in the game.
                    </p>
                  </div>

                  <label className="block text-sm text-zinc-300">
                    Student name
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      maxLength={20}
                      placeholder="e.g. Tunde Bright"
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white outline-none focus:border-amber-400"
                    />
                  </label>

                  <label className="block text-sm text-zinc-300">
                    Age: <span className="font-bold text-white">{age}</span>
                    <input
                      type="range"
                      min={16}
                      max={30}
                      value={age}
                      onChange={(e) => setAge(Number(e.target.value))}
                      className="mt-2 w-full accent-amber-400"
                    />
                  </label>

                  <div>
                    <p className="text-sm text-zinc-300">Gender</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {GENDERS.map((g) => (
                        <button
                          key={g.value}
                          type="button"
                          onClick={() => setGender(g.value)}
                          className={chip(gender === g.value)}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <h1 className="text-2xl font-extrabold">Pick your look</h1>
                  {preview}

                  <div>
                    <p className="text-sm text-zinc-300">Skin tone</p>
                    <div className="mt-2 flex gap-3">
                      {SKIN_TONES.map((c, i) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Skin tone ${i + 1}`}
                          onClick={() => setSkin(i)}
                          style={{ backgroundColor: c }}
                          className={
                            "h-10 w-10 rounded-full border-2 " +
                            (skin === i ? "border-amber-400" : "border-transparent")
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-zinc-300">Hair style</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {HAIR_STYLE_NAMES.map((n, i) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setHairStyle(i)}
                          className={chip(hairStyle === i)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-zinc-300">Hair colour</p>
                    <div className="mt-2 flex gap-3">
                      {HAIR_COLORS.map((c, i) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Hair colour ${i + 1}`}
                          onClick={() => setHairColor(i)}
                          style={{ backgroundColor: c }}
                          className={
                            "h-10 w-10 rounded-full border-2 " +
                            (hairColor === i ? "border-amber-400" : "border-white/20")
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-zinc-300">Outfit</p>
                    <div className="mt-2 flex gap-3">
                      {OUTFITS.map((o, i) => (
                        <button
                          key={o.name}
                          type="button"
                          aria-label={o.name}
                          onClick={() => setOutfit(i)}
                          style={{ backgroundColor: o.color }}
                          className={
                            "h-10 w-10 rounded-xl border-2 " +
                            (outfit === i ? "border-amber-400" : "border-white/20")
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-2xl font-extrabold">Where do you come from?</h1>
                    <p className="mt-1 text-sm text-zinc-400">
                      Your story decides your starting money and your early strengths. Less
                      cash means bigger strengths.
                    </p>
                  </div>
                  {backgrounds.map((b) => (
                    <button
                      key={b.slug}
                      type="button"
                      onClick={() => setBackground(b.slug)}
                      className={
                        "w-full rounded-2xl border p-4 text-left transition active:scale-[0.98] " +
                        (background === b.slug
                          ? "border-amber-400 bg-amber-400/10"
                          : "border-white/10 bg-white/5")
                      }
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{b.name}</span>
                        <span className="text-sm font-bold text-emerald-300">
                          {formatNaira(b.starting_wallet_kobo)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-400">{b.blurb}</p>
                      <div className="mt-3 space-y-1">
                        <Dots label="Academic" value={b.academic_bonus} />
                        <Dots label="Hustle" value={b.hustle_bonus} />
                        <Dots label="Social" value={b.social_bonus} />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-2xl font-extrabold">What pulls you in?</h1>
                    <p className="mt-1 text-sm text-zinc-400">
                      Your interest shapes the courses we suggest when you apply.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {INTERESTS.map((i) => (
                      <button
                        key={i.value}
                        type="button"
                        onClick={() => setInterest(i.value)}
                        className={
                          "rounded-2xl border p-4 text-left transition active:scale-95 " +
                          (interest === i.value
                            ? "border-amber-400 bg-amber-400/10"
                            : "border-white/10 bg-white/5")
                        }
                      >
                        <div className="text-2xl">{i.icon}</div>
                        <div className="mt-2 text-sm font-semibold">{i.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-5 text-center">
                  <h1 className="text-2xl font-extrabold">Meet your student</h1>
                  {preview}
                  <div>
                    <p className="text-xl font-extrabold">{name}</p>
                    <p className="text-sm text-zinc-400">
                      {age} years old · {GENDERS.find((g) => g.value === gender)?.label}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-sm">
                    <p>
                      <span className="text-zinc-500">Story: </span>
                      {chosenBackground?.name}
                    </p>
                    <p className="mt-1">
                      <span className="text-zinc-500">Starting money: </span>
                      <span className="font-bold text-emerald-300">
                        {chosenBackground ? formatNaira(chosenBackground.starting_wallet_kobo) : ""}
                      </span>
                    </p>
                    <p className="mt-1">
                      <span className="text-zinc-500">Interest: </span>
                      {chosenInterest?.icon} {chosenInterest?.label}
                    </p>
                  </div>
                  {state?.error && (
                    <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                      {state.error}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {hint && <p className="mt-4 text-sm text-amber-300">{hint}</p>}

          <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#0b1020]/95 px-4 py-4 backdrop-blur">
            <div className="mx-auto flex max-w-md gap-3">
              {step > 0 && (
                <button
                  type="button"
                  onClick={back}
                  className="rounded-2xl border border-white/20 px-5 py-4 text-sm font-semibold text-zinc-300"
                >
                  Back
                </button>
              )}
              {step < 4 ? (
                <button
                  type="button"
                  onClick={next}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-4 text-base font-extrabold text-black active:scale-95"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-4 text-base font-extrabold text-black disabled:opacity-60 active:scale-95"
                >
                  {pending ? "Creating..." : "Start my story"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}