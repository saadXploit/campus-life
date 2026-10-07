"use client";

import Link from "next/link";
import { useState } from "react";
import type { SceneConfig } from "@/lib/game/scenes";
import type { SceneAvatar } from "./AvatarLayer";
import SceneStage from "./SceneStage";

export default function RoomView({
  scene,
  hour,
  clock,
  avatar,
  debug,
}: {
  scene: SceneConfig;
  hour: number;
  clock: string;
  avatar: SceneAvatar;
  debug: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const spot = scene.hotspots.find((h) => h.id === selected) ?? null;

  return (
    <main className="fixed inset-0 overflow-hidden bg-black text-white">
      <div className="absolute inset-0 flex items-center justify-center">
        <SceneStage
          scene={scene}
          hour={hour}
          avatar={avatar}
          selected={selected}
          onSelect={setSelected}
          debug={debug}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <Link
          href="/home"
          className="pointer-events-auto rounded-full bg-black/40 px-4 py-2 text-sm backdrop-blur"
        >
          Back
        </Link>
        <span className="rounded-full bg-black/40 px-4 py-2 text-sm font-bold backdrop-blur">
          {scene.title} · {clock}
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-black/55 p-4 backdrop-blur">
          {spot ? (
            <>
              <p className="font-bold">{spot.label}</p>
              <p className="mt-1 text-sm text-zinc-300">{spot.text}</p>
            </>
          ) : (
            <p className="text-center text-sm text-zinc-300">
              Tap the glowing spots to look around.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}