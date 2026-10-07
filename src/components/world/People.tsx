"use client";

import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import Avatar3D from "@/components/scene/Avatar3D";
import type { Pose } from "@/lib/game/interiors";
import { makeLabelTexture } from "./labels";

export function NameTag({ name, highlight = false }: { name: string; highlight?: boolean }) {
  const label = useMemo(
    () => makeLabelTexture(name, { width: 384, accent: highlight ? "#34d399" : "#fbbf24" }),
    [name, highlight]
  );
  useEffect(() => () => label.texture.dispose(), [label]);
  return (
    <sprite position={[0, 2.45, 0]} scale={[0.5 * label.aspect, 0.5, 1]}>
      <spriteMaterial map={label.texture} depthWrite={false} transparent />
    </sprite>
  );
}

/** A speech or emoji bubble floating above someone's head. */
export function Bubble({ text }: { text: string }) {
  const label = useMemo(
    () => makeLabelTexture(text, { bg: "rgba(255,255,255,0.95)", fg: "#111827", accent: "#ffffff", width: 640 }),
    [text]
  );
  useEffect(() => () => label.texture.dispose(), [label]);
  const h = 0.55;
  return (
    <sprite position={[0, 3.05, 0]} scale={[h * label.aspect, h, 1]}>
      <spriteMaterial map={label.texture} depthWrite={false} depthTest={false} transparent />
    </sprite>
  );
}

export type ShownPerson = {
  id: string;
  name: string;
  avatar: { skin: number; hairStyle: number; hairColor: number; outfit: number };
  x: number;
  y: number;
  z: number;
  heading: number;
  pose: Pose;
  bubble: string | null;
  friend: boolean;
};

/** Another real player. Tap them to see what you can do together. */
export function OtherPlayer({ p, onSelect }: { p: ShownPerson; onSelect: (id: string) => void }) {
  function click(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    onSelect(p.id);
  }
  return (
    <group position={[p.x, p.y, p.z]} rotation={[0, p.heading, 0]} onClick={click}>
      <Avatar3D
        skin={p.avatar.skin}
        hairStyle={p.avatar.hairStyle}
        hairColor={p.avatar.hairColor}
        outfit={p.avatar.outfit}
        action={p.pose}
      />
      {/* An invisible, larger target so people are easy to tap on a phone. */}
      <mesh position={[0, 1, 0]} visible={false}>
        <cylinderGeometry args={[0.55, 0.55, 2.2, 8]} />
        <meshBasicMaterial />
      </mesh>
      <group rotation={[0, -p.heading, 0]}>
        <NameTag name={p.name} highlight={p.friend} />
        {p.bubble && <Bubble text={p.bubble} />}
      </group>
    </group>
  );
}
