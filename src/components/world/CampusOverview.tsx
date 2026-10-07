"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import type { GameAd } from "@/lib/game/gameTypes";
import { lightingFor } from "@/lib/game/lighting";
import { footprintOf } from "@/lib/game/worldLayout";
import { makeLabelTexture } from "./labels";
import { CampusBase, useCampusLayout, type Placed, type WorldLocation } from "./Scenery";

export type CameraControl = { yaw: number; zoom: number; moved: number };

/** Turns the camera around the campus from the drag and zoom the player does. */
function Rig({ control }: { control: RefObject<CameraControl> }) {
  useFrame(({ camera }, delta) => {
    const c = control.current;
    const dist = 150 * c.zoom;
    const tx = Math.sin(c.yaw) * dist * 0.75;
    const tz = Math.cos(c.yaw) * dist * 0.75;
    const k = 1 - Math.exp(-delta * 8);
    camera.position.x += (tx - camera.position.x) * k;
    camera.position.y += (dist * 0.8 - camera.position.y) * k;
    camera.position.z += (tz - camera.position.z) * k;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/** "You are here" pin bobbing above the building. */
function Pin({ x, y, z }: { x: number; y: number; z: number }) {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    if (ref.current) ref.current.position.y = y + Math.sin(state.clock.elapsedTime * 3) * 0.8;
  });
  return (
    <mesh ref={ref} position={[x, y, z]} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[1.6, 3.6, 16]} />
      <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.8} />
    </mesh>
  );
}

function CountBadge({ x, y, z, count }: { x: number; y: number; z: number; count: number }) {
  const label = useMemo(() => makeLabelTexture(`👥 ${count}`, { width: 256, accent: "#34d399" }), [count]);
  useEffect(() => () => label.texture.dispose(), [label]);
  return (
    <sprite position={[x, y, z]} scale={[3 * label.aspect, 3, 1]}>
      <spriteMaterial map={label.texture} depthWrite={false} depthTest={false} transparent />
    </sprite>
  );
}

function SelectRing({ p }: { p: Placed }) {
  const f = footprintOf(p.kind);
  const r = Math.max(f.w, f.d) / 2 + 3;
  return (
    <mesh position={[p.x, 0.1, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r, r + 0.8, 48]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </mesh>
  );
}

export default function CampusOverview({
  locations,
  primary,
  secondary,
  hour,
  ads,
  currentKind,
  selectedId,
  counts,
  control,
  onSelect,
  onSelectAd,
}: {
  locations: WorldLocation[];
  primary: string;
  secondary: string;
  hour: number;
  ads: GameAd[];
  currentKind: string | null;
  selectedId: string | null;
  counts: Record<string, number>;
  control: RefObject<CameraControl>;
  onSelect: (id: string | null) => void;
  onSelectAd: (ad: GameAd) => void;
}) {
  const layout = useCampusLayout(locations);
  const light = lightingFor(hour);
  const current = layout.placed.find((p) => p.kind === currentKind) ?? null;
  const selected = layout.placed.find((p) => p.id === selectedId) ?? null;

  // A drag that turned the camera is not a tap on a building.
  const tapped = (fn: () => void) => () => {
    if (control.current.moved < 8) fn();
  };

  return (
    <Canvas dpr={[1, 1.5]} camera={{ fov: 40, near: 1, far: 600, position: [0, 120, 110] }}>
      <color attach="background" args={[light.sky]} />
      <fog attach="fog" args={[light.sky, 220, 420]} />
      <hemisphereLight args={[light.sky, "#3d5a2a", light.ambient * 1.1]} />
      <ambientLight intensity={light.ambient * 0.6} />
      <directionalLight position={[60, 120, 40]} intensity={light.sun * 1.4} color={light.sunColor} />

      <CampusBase
        layout={layout}
        primary={primary}
        secondary={secondary}
        night={light.lamp}
        ads={ads}
        adRotation={0}
        onGround={() => tapped(() => onSelect(null))()}
        onSelectBuilding={(p) => tapped(() => onSelect(p.id))()}
        onSelectAd={(ad) => tapped(() => onSelectAd(ad))()}
      />

      {layout.placed.map((p) => {
        const n = counts[p.kind] ?? 0;
        return n > 0 ? (
          <CountBadge key={p.id} x={p.x} y={Math.max(footprintOf(p.kind).h, 3) + 7} z={p.z} count={n} />
        ) : null;
      })}
      {current && <Pin x={current.x} y={Math.max(footprintOf(current.kind).h, 3) + 12} z={current.z} />}
      {selected && <SelectRing p={selected} />}
      <Rig control={control} />
    </Canvas>
  );
}
