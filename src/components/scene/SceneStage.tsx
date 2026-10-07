"use client";

import dynamic from "next/dynamic";
import { useState, type MouseEvent } from "react";
import { motion } from "framer-motion";
import { timeSlot, type SceneConfig } from "@/lib/game/scenes";
import type { SceneAvatar } from "./AvatarLayer";

const AvatarLayer = dynamic(() => import("./AvatarLayer"), { ssr: false });

const TINTS = {
  morning: "rgb(255, 225, 190)",
  evening: "rgb(255, 175, 120)",
  night: "rgb(70, 85, 150)",
};

export default function SceneStage({
  scene,
  hour,
  avatar,
  selected,
  onSelect,
  debug,
}: {
  scene: SceneConfig;
  hour: number;
  avatar: SceneAvatar;
  selected: string | null;
  onSelect: (id: string | null) => void;
  debug: boolean;
}) {
  const slot = timeSlot(hour);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [probe, setProbe] = useState<string | null>(null);

  // If the evening or night picture is missing, use the day picture with a colour tint instead.
  const usingDayFallback = Boolean(failed[slot]) && slot !== "day";
  const shownKey = usingDayFallback ? "day" : slot;
  const src = scene.images[shownKey];
  const missing = Boolean(failed[shownKey]);

  let tint: string | null = null;
  if (usingDayFallback) tint = slot === "evening" ? TINTS.evening : TINTS.night;
  else if (slot === "day" && hour < 8) tint = TINTS.morning;

  function probeClick(e: MouseEvent<HTMLDivElement>) {
    if (!debug) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setProbe(`x ${x.toFixed(0)}%   y ${y.toFixed(0)}%`);
  }

  return (
    <div
      className="relative aspect-[9/16] h-dvh shrink-0 overflow-hidden bg-[#0b1020]"
      onClick={probeClick}
    >
      <motion.div
        className="absolute inset-0"
        animate={{ scale: [1, 1.025, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      >
        {missing ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#2b3358] via-[#3a2f4d] to-[#1a1626] p-8 text-center">
            <p className="text-sm font-semibold text-amber-300">Scene art not added yet</p>
            <p className="mt-2 break-all text-xs text-zinc-400">
              Add the picture at {scene.images.day.replace("/", "public/")}
            </p>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            draggable={false}
            onError={() => setFailed((prev) => ({ ...prev, [shownKey]: true }))}
            className="absolute inset-0 h-full w-full select-none object-cover"
          />
        )}

        {tint && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundColor: tint, mixBlendMode: "multiply" }}
          />
        )}

        <div className="pointer-events-none absolute inset-0">
          <AvatarLayer hour={hour} avatar={avatar} slot={scene.stage[0]} />
        </div>

        {scene.hotspots.map((h) => {
          const active = selected === h.id;
          return (
            <button
              key={h.id}
              type="button"
              aria-label={h.label}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(active ? null : h.id);
              }}
              className={
                "absolute rounded-2xl transition " +
                (active
                  ? "border-2 border-amber-300 bg-amber-300/15"
                  : debug
                    ? "border border-dashed border-white/70 bg-white/10"
                    : "border border-transparent")
              }
              style={{ left: `${h.x}%`, top: `${h.y}%`, width: `${h.w}%`, height: `${h.h}%` }}
            >
              {!active && (
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <span className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-amber-300/70" />
                  <span className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300" />
                </span>
              )}
              {debug && (
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px]">
                  {h.id}
                </span>
              )}
            </button>
          );
        })}
      </motion.div>

      {debug && probe && (
        <div className="absolute left-3 top-16 rounded bg-black/80 px-3 py-2 text-xs font-bold text-amber-300">
          {probe}
        </div>
      )}
    </div>
  );
}