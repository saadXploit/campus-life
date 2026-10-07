"use client";

import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { footprintOf } from "@/lib/game/worldLayout";
import { makeLabelTexture } from "./labels";

export type BuildingProps = {
  kind: string;
  name: string;
  x: number;
  z: number;
  primary: string;
  secondary: string;
  night: boolean;
  billboard: boolean;
  onSelect: () => void;
};

const WALL = "#efe6d6";
const GLASS = "#9cc3d5";
const LIT = "#ffd27a";

/** A grid of windows on the front of a building. They glow at night. */
function Windows({
  w,
  h,
  z,
  rows,
  cols,
  y0,
  night,
}: {
  w: number;
  h: number;
  z: number;
  rows: number;
  cols: number;
  y0: number;
  night: boolean;
}) {
  const items: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      items.push([-w / 2 + (w / cols) * (c + 0.5), y0 + (h / rows) * (r + 0.5)]);
    }
  }
  return (
    <>
      {items.map(([x, y], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[(w / cols) * 0.55, (h / rows) * 0.5, 0.1]} />
          <meshStandardMaterial
            color={night && i % 3 !== 0 ? LIT : GLASS}
            emissive={night && i % 3 !== 0 ? LIT : "#000000"}
            emissiveIntensity={night ? 1.2 : 0}
            roughness={0.3}
          />
        </mesh>
      ))}
    </>
  );
}

function Door({ z, color, w = 2, h = 2.6 }: { z: number; color: string; w?: number; h?: number }) {
  return (
    <mesh position={[0, h / 2, z]}>
      <boxGeometry args={[w, h, 0.15]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}

function Block({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  return (
    <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

function Roof({ w, d, y, color }: { w: number; d: number; y: number; color: string }) {
  return (
    <mesh position={[0, y + 0.25, 0]} castShadow>
      <boxGeometry args={[w + 0.8, 0.5, d + 0.8]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}

function Sign({ text, y, accent }: { text: string; y: number; accent: string }) {
  const label = useMemo(() => makeLabelTexture(text, { accent }), [text, accent]);
  useEffect(() => () => label.texture.dispose(), [label]);
  const h = 1.3;
  return (
    <sprite position={[0, y, 0]} scale={[h * label.aspect, h, 1]}>
      <spriteMaterial map={label.texture} depthWrite={false} transparent />
    </sprite>
  );
}

function Billboard({ x, z, primary }: { x: number; z: number; primary: string }) {
  const label = useMemo(
    () => makeLabelTexture("LIVE YOUR CAMPUS LIFE", { bg: primary, accent: "#fbbf24" }),
    [primary]
  );
  useEffect(() => () => label.texture.dispose(), [label]);
  return (
    <group position={[x, 0, z]} rotation={[0, 0.35, 0]}>
      {[-2.2, 2.2].map((px) => (
        <mesh key={px} position={[px, 2.5, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 5, 8]} />
          <meshStandardMaterial color="#4b5563" />
        </mesh>
      ))}
      <mesh position={[0, 5.3, 0]} castShadow>
        <boxGeometry args={[6.4, 1.9, 0.2]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[0, 5.3, 0.11]}>
        <planeGeometry args={[6.1, 1.6]} />
        <meshBasicMaterial map={label.texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Hostel({ primary, night }: { primary: string; night: boolean }) {
  const f = footprintOf("hostel");
  return (
    <>
      <Block w={f.w} d={f.d} h={f.h} color={WALL} />
      <Roof w={f.w} d={f.d} y={f.h} color={primary} />
      <Windows w={f.w - 2} h={f.h - 3} z={f.d / 2 + 0.01} rows={3} cols={7} y0={2.8} night={night} />
      {/* balcony rails */}
      {[3.9, 6.4].map((y) => (
        <mesh key={y} position={[0, y, f.d / 2 + 0.5]} castShadow>
          <boxGeometry args={[f.w - 1, 0.15, 1]} />
          <meshStandardMaterial color={primary} />
        </mesh>
      ))}
      <Door z={f.d / 2 + 0.02} color="#7c4a2a" />
    </>
  );
}

function Faculty({ primary, secondary, night }: { primary: string; secondary: string; night: boolean }) {
  const f = footprintOf("faculty");
  return (
    <>
      <Block w={f.w} d={f.d} h={f.h} color="#e7e2d8" />
      <Roof w={f.w} d={f.d} y={f.h} color={primary} />
      <Windows w={f.w - 8} h={f.h - 4} z={f.d / 2 + 0.01} rows={2} cols={5} y0={3.5} night={night} />
      {/* columns and pediment */}
      {[-3, -1, 1, 3].map((x) => (
        <mesh key={x} position={[x, 3.5, f.d / 2 + 1.6]} castShadow>
          <cylinderGeometry args={[0.35, 0.4, 7, 12]} />
          <meshStandardMaterial color="#f8f6f0" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 7.4, f.d / 2 + 1.6]} castShadow>
        <boxGeometry args={[9, 0.8, 3.4]} />
        <meshStandardMaterial color={secondary} />
      </mesh>
      {[0.3, 0.6].map((y, i) => (
        <mesh key={y} position={[0, y / 2, f.d / 2 + 2.6 + i * 0.6]} receiveShadow>
          <boxGeometry args={[10 - i * 1.5, y, 1.2]} />
          <meshStandardMaterial color="#d6d3d1" />
        </mesh>
      ))}
      <Door z={f.d / 2 + 0.02} color="#3f2a1d" w={2.4} h={3.2} />
    </>
  );
}

function Library({ primary, night }: { primary: string; night: boolean }) {
  const f = footprintOf("library");
  return (
    <>
      <Block w={f.w} d={f.d} h={f.h} color="#d9cfc1" />
      <mesh position={[0, f.h, 0]} castShadow>
        <sphereGeometry args={[4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={primary} roughness={0.5} metalness={0.2} />
      </mesh>
      <Windows w={f.w - 2} h={f.h - 2.5} z={f.d / 2 + 0.01} rows={1} cols={6} y0={1.5} night={night} />
      <Door z={f.d / 2 + 0.02} color="#3f2a1d" />
    </>
  );
}

function Cafeteria({ secondary, night }: { secondary: string; night: boolean }) {
  const f = footprintOf("cafeteria");
  return (
    <>
      <Block w={f.w} d={f.d} h={f.h} color="#f2e8d5" />
      <Roof w={f.w} d={f.d} y={f.h} color="#9a3412" />
      <Windows w={f.w - 4} h={2} z={f.d / 2 + 0.01} rows={1} cols={4} y0={1.2} night={night} />
      {/* striped awning */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh
          key={i}
          position={[-f.w / 2 + 1 + i * ((f.w - 2) / 8) + (f.w - 2) / 16, 3.6, f.d / 2 + 1]}
          rotation={[0.45, 0, 0]}
          castShadow
        >
          <boxGeometry args={[(f.w - 2) / 8, 0.08, 2.2]} />
          <meshStandardMaterial color={i % 2 ? "#ffffff" : secondary} />
        </mesh>
      ))}
      {/* outdoor tables */}
      {[-4, 4].map((x) => (
        <group key={x} position={[x, 0, f.d / 2 + 3.5]}>
          <mesh position={[0, 0.75, 0]} castShadow>
            <cylinderGeometry args={[0.8, 0.8, 0.08, 16]} />
            <meshStandardMaterial color="#e5e7eb" />
          </mesh>
          <mesh position={[0, 0.375, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.75, 8]} />
            <meshStandardMaterial color="#6b7280" />
          </mesh>
        </group>
      ))}
      <Door z={f.d / 2 + 0.02} color="#7c4a2a" />
    </>
  );
}

function Market({ primary, secondary }: { primary: string; secondary: string }) {
  const colors = [secondary, "#ef4444", "#22c55e", primary, "#3b82f6", "#f97316"];
  return (
    <>
      {colors.map((c, i) => {
        const x = -6 + (i % 3) * 6;
        const z = i < 3 ? -2.5 : 2.5;
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 0.5, 0]} castShadow>
              <boxGeometry args={[3.6, 1, 1.6]} />
              <meshStandardMaterial color="#8b5a2b" />
            </mesh>
            {[-1.7, 1.7].map((px) => (
              <mesh key={px} position={[px, 1.4, 0]}>
                <cylinderGeometry args={[0.06, 0.06, 2.8, 6]} />
                <meshStandardMaterial color="#4b5563" />
              </mesh>
            ))}
            <mesh position={[0, 2.9, 0]} castShadow>
              <coneGeometry args={[2.6, 0.9, 4]} />
              <meshStandardMaterial color={c} roughness={0.8} />
            </mesh>
            {/* goods on the table */}
            {[-1, 0, 1].map((gx) => (
              <mesh key={gx} position={[gx, 1.15, 0]}>
                <sphereGeometry args={[0.22, 8, 6]} />
                <meshStandardMaterial color={["#f59e0b", "#84cc16", "#dc2626"][(gx + 1 + i) % 3]} />
              </mesh>
            ))}
          </group>
        );
      })}
    </>
  );
}

function Sports() {
  const f = footprintOf("sports");
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <planeGeometry args={[f.w, f.d]} />
        <meshStandardMaterial color="#2f8f3a" roughness={1} />
      </mesh>
      {/* white lines */}
      {[
        [0, 0, 0.15, f.d - 1],
        [0, -(f.d - 1) / 2, f.w - 1, 0.15],
        [0, (f.d - 1) / 2, f.w - 1, 0.15],
        [-(f.w - 1) / 2, 0, 0.15, f.d - 1],
        [(f.w - 1) / 2, 0, 0.15, f.d - 1],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.05, z]}>
          <planeGeometry args={[w, d]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[2.4, 2.6, 32]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* goals */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * ((f.w - 1) / 2), 0, 0]}>
          {[-1.8, 1.8].map((z) => (
            <mesh key={z} position={[0, 1.1, z]} castShadow>
              <cylinderGeometry args={[0.08, 0.08, 2.2, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          ))}
          <mesh position={[0, 2.2, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 3.7, 8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
      {/* small stand */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.3 + i * 0.4, -(f.d / 2) - 1 - i * 0.8]} castShadow receiveShadow>
          <boxGeometry args={[12, 0.6 + i * 0.8, 0.8]} />
          <meshStandardMaterial color="#9ca3af" />
        </mesh>
      ))}
    </>
  );
}

function Clubhouse({ primary, night }: { primary: string; night: boolean }) {
  const f = footprintOf("clubhouse");
  const neon = "#e879f9";
  return (
    <>
      <Block w={f.w} d={f.d} h={f.h} color="#1f1b2e" />
      <Roof w={f.w} d={f.d} y={f.h} color="#111827" />
      {[1.2, f.h - 0.4].map((y) => (
        <mesh key={y} position={[0, y, f.d / 2 + 0.06]}>
          <boxGeometry args={[f.w - 0.4, 0.12, 0.1]} />
          <meshStandardMaterial color={neon} emissive={neon} emissiveIntensity={night ? 3 : 1} />
        </mesh>
      ))}
      {[-f.w / 2 + 0.2, f.w / 2 - 0.2].map((x) => (
        <mesh key={x} position={[x, f.h / 2, f.d / 2 + 0.06]}>
          <boxGeometry args={[0.12, f.h - 1.6, 0.1]} />
          <meshStandardMaterial color={primary} emissive={primary} emissiveIntensity={night ? 3 : 1} />
        </mesh>
      ))}
      <Door z={f.d / 2 + 0.02} color="#7e22ce" w={2.6} />
    </>
  );
}

function Health({ night }: { night: boolean }) {
  const f = footprintOf("health");
  return (
    <>
      <Block w={f.w} d={f.d} h={f.h} color="#f8fafc" />
      <Roof w={f.w} d={f.d} y={f.h} color="#64748b" />
      <Windows w={f.w - 3} h={2} z={f.d / 2 + 0.01} rows={1} cols={4} y0={1.4} night={night} />
      {/* red cross */}
      <group position={[0, f.h - 1.2, f.d / 2 + 0.1]}>
        <mesh>
          <boxGeometry args={[1.8, 0.55, 0.1]} />
          <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={night ? 1.5 : 0.2} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.55, 1.8, 0.1]} />
          <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={night ? 1.5 : 0.2} />
        </mesh>
      </group>
      <Door z={f.d / 2 + 0.02} color="#0ea5e9" />
    </>
  );
}

export default function Building({
  kind,
  name,
  x,
  z,
  primary,
  secondary,
  night,
  billboard,
  onSelect,
}: BuildingProps) {
  const f = footprintOf(kind);

  function click(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    onSelect();
  }

  return (
    <>
      <group position={[x, 0, z]} onClick={click}>
        {kind === "hostel" && <Hostel primary={primary} night={night} />}
        {kind === "faculty" && <Faculty primary={primary} secondary={secondary} night={night} />}
        {kind === "library" && <Library primary={primary} night={night} />}
        {kind === "cafeteria" && <Cafeteria secondary={secondary} night={night} />}
        {kind === "market" && <Market primary={primary} secondary={secondary} />}
        {kind === "sports" && <Sports />}
        {kind === "clubhouse" && <Clubhouse primary={primary} night={night} />}
        {kind === "health" && <Health night={night} />}
        <Sign text={name} y={Math.max(f.h, 3) + 2.2} accent={secondary} />
      </group>
      {billboard && <Billboard x={x + f.w / 2 + 3} z={z + f.d / 2} primary={primary} />}
    </>
  );
}
