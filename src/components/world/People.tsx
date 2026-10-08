"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { Group } from "three";
import Avatar3D from "@/components/scene/Avatar3D";
import type { Pose } from "@/lib/game/interiors";
import type { Appearance } from "@/lib/game/shop";
import { UNIFORMS, type StaffMember } from "@/lib/game/staff";
import { makeLabelTexture } from "./labels";

/** Avatar props for what someone bought in the shop. */
export function appearanceProps(a: Appearance | null | undefined) {
  if (!a) return {};
  return {
    shirtColor: a.shirt,
    trouserColor: a.trousers,
    capColor: a.cap ?? null,
    robeColor: a.robe,
    glassesColor: a.glasses,
    chainColor: a.chain,
    shoeColor: a.shoes,
  };
}

export type PlacedStaff = { staff: StaffMember; x: number; y: number; z: number; heading: number; pose: Pose };

/**
 * A staff character (security, cleaner, boss...). Drawn by the game, never a real player,
 * so it costs no network traffic. Patrolling guards walk up and down by themselves.
 */
export function StaffNpc({
  p,
  bubble,
  onSelect,
}: {
  p: PlacedStaff;
  bubble: string | null;
  onSelect: (id: string) => void;
}) {
  const group = useRef<Group>(null);
  const { staff } = p;
  const uniform = staff.uniform ? UNIFORMS[staff.uniform] : null;

  useFrame((state) => {
    const g = group.current;
    if (!g || !staff.patrol) return;
    const t = state.clock.elapsedTime * 0.22;
    g.position.x = p.x + Math.sin(t) * 5;
    g.rotation.y = Math.cos(t) >= 0 ? Math.PI / 2 : -Math.PI / 2;
  });

  function click(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    onSelect(staff.id);
  }

  return (
    <group ref={group} position={[p.x, p.y, p.z]} rotation={[0, p.heading, 0]} onClick={click}>
      <Avatar3D
        skin={staff.avatar.skin}
        hairStyle={staff.avatar.hairStyle}
        hairColor={staff.avatar.hairColor}
        outfit={staff.avatar.outfit}
        shirtColor={uniform?.shirt}
        trouserColor={uniform?.trousers}
        capColor={uniform?.cap ?? null}
        action={staff.patrol ? "walk" : p.pose}
      />
      <mesh position={[0, 1, 0]} visible={false}>
        <cylinderGeometry args={[0.55, 0.55, 2.2, 8]} />
        <meshBasicMaterial />
      </mesh>
      <NameTag name={`${staff.name} · ${staff.title}`} accent="#38bdf8" />
      {bubble && <Bubble text={bubble} />}
    </group>
  );
}

export function NameTag({
  name,
  highlight = false,
  accent,
  shine,
}: {
  name: string;
  highlight?: boolean;
  /** Underline colour; staff use blue so they are never mistaken for players. */
  accent?: string;
  /** A bought name tag (gold, diamond): the whole tag takes this colour. */
  shine?: string;
}) {
  const label = useMemo(
    () =>
      shine
        ? makeLabelTexture(name, { width: 384, bg: shine + "ee", fg: "#111827", accent: "#ffffff" })
        : makeLabelTexture(name, {
            width: accent ? 512 : 384,
            accent: accent ?? (highlight ? "#34d399" : "#fbbf24"),
          }),
    [name, highlight, accent, shine]
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
  /** Shop items they wear. */
  appearance?: Appearance;
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
        {...appearanceProps(p.appearance)}
      />
      {/* An invisible, larger target so people are easy to tap on a phone. */}
      <mesh position={[0, 1, 0]} visible={false}>
        <cylinderGeometry args={[0.55, 0.55, 2.2, 8]} />
        <meshBasicMaterial />
      </mesh>
      <group rotation={[0, -p.heading, 0]}>
        <NameTag name={p.name} highlight={p.friend} shine={p.appearance?.tag} />
        {p.bubble && <Bubble text={p.bubble} />}
      </group>
    </group>
  );
}
