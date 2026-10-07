"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Color,
  Object3D,
  type Group,
  type InstancedMesh,
  type Mesh,
  type MeshStandardMaterial,
} from "three";
import Avatar3D from "@/components/scene/Avatar3D";
import { ROOM, type Pose, type Spot } from "@/lib/game/interiors";
import { lightingFor } from "@/lib/game/lighting";
import { seededRandom } from "@/lib/game/worldLayout";
import type { WorldAvatar } from "./CampusWorld";
import { makeLabelTexture } from "./labels";

type V3 = [number, number, number];

// ---------- Small building blocks ----------

function B({
  p,
  s,
  c,
  e,
  rough = 0.8,
  r,
}: {
  p: V3;
  s: V3;
  c: string;
  e?: number;
  rough?: number;
  r?: V3;
}) {
  return (
    <mesh position={p} rotation={r}>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={c}
        roughness={rough}
        emissive={e ? c : "#000000"}
        emissiveIntensity={e ?? 0}
      />
    </mesh>
  );
}

function Cyl({ p, r, h, c, seg = 16 }: { p: V3; r: number; h: number; c: string; seg?: number }) {
  return (
    <mesh position={p}>
      <cylinderGeometry args={[r, r, h, seg]} />
      <meshStandardMaterial color={c} roughness={0.6} />
    </mesh>
  );
}

/** A chair whose seat is at height 0.45, facing the given way (0 = towards the camera). */
function Chair({ x, z, heading = 0, c = "#7c5a3a" }: { x: number; z: number; heading?: number; c?: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, heading, 0]}>
      <B p={[0, 0.42, 0]} s={[0.5, 0.06, 0.5]} c={c} />
      <B p={[0, 0.75, -0.24]} s={[0.5, 0.6, 0.05]} c={c} />
      {[
        [-0.22, -0.22],
        [0.22, -0.22],
        [-0.22, 0.22],
        [0.22, 0.22],
      ].map(([lx, lz], i) => (
        <B key={i} p={[lx, 0.2, lz]} s={[0.05, 0.4, 0.05]} c="#3f3f46" />
      ))}
    </group>
  );
}

function Table({ x, z, w = 1.4, d = 0.9, h = 0.75, c = "#a16207" }: { x: number; z: number; w?: number; d?: number; h?: number; c?: string }) {
  return (
    <group position={[x, 0, z]}>
      <B p={[0, h, 0]} s={[w, 0.06, d]} c={c} rough={0.5} />
      {[
        [-w / 2 + 0.08, -d / 2 + 0.08],
        [w / 2 - 0.08, -d / 2 + 0.08],
        [-w / 2 + 0.08, d / 2 - 0.08],
        [w / 2 - 0.08, d / 2 - 0.08],
      ].map(([lx, lz], i) => (
        <B key={i} p={[lx, h / 2, lz]} s={[0.06, h, 0.06]} c="#3f3f46" />
      ))}
    </group>
  );
}

function WallText({ text, p, w, bg, fg }: { text: string; p: V3; w: number; bg: string; fg: string }) {
  const label = useMemo(() => makeLabelTexture(text, { bg, fg, accent: bg, width: 768 }), [text, bg, fg]);
  useEffect(() => () => label.texture.dispose(), [label]);
  return (
    <mesh position={p}>
      <planeGeometry args={[w, w / label.aspect]} />
      <meshBasicMaterial map={label.texture} toneMapped={false} transparent />
    </mesh>
  );
}

/** The window on the back wall shows the sky colour for the time of day. */
function BackWindow({ x, sky, y = 2.1 }: { x: number; sky: string; y?: number }) {
  const z = -ROOM.d / 2 + 0.02;
  return (
    <group position={[x, y, z]}>
      <B p={[0, 0, 0]} s={[1.9, 1.2, 0.06]} c="#e5e7eb" />
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[1.7, 1.0]} />
        <meshBasicMaterial color={sky} toneMapped={false} />
      </mesh>
      <B p={[0, 0, 0.06]} s={[0.05, 1.0, 0.02]} c="#e5e7eb" />
    </group>
  );
}

function Shell({ wall, floor }: { wall: string; floor: string }) {
  const { w, d, h } = ROOM;
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={floor} roughness={0.9} />
      </mesh>
      <B p={[0, h / 2, -d / 2]} s={[w, h, 0.1]} c={wall} rough={1} />
      <B p={[-w / 2, h / 2, 0]} s={[0.1, h, d]} c={wall} rough={1} />
      <B p={[w / 2, h / 2, 0]} s={[0.1, h, d]} c={wall} rough={1} />
      {/* skirting */}
      <B p={[0, 0.06, -d / 2 + 0.06]} s={[w, 0.12, 0.04]} c="#4b5563" />
      <B p={[-w / 2 + 0.06, 0.06, 0]} s={[0.04, 0.12, d]} c="#4b5563" />
      <B p={[w / 2 - 0.06, 0.06, 0]} s={[0.04, 0.12, d]} c="#4b5563" />
    </>
  );
}

// ---------- Rooms ----------

function BunkBed({ x, blanket, top }: { x: number; blanket: string; top: string }) {
  const z = -1.5;
  return (
    <group position={[x, 0, z]}>
      {[
        [-0.5, -1.0],
        [0.5, -1.0],
        [-0.5, 1.0],
        [0.5, 1.0],
      ].map(([px, pz], i) => (
        <B key={i} p={[px, 1.15, pz]} s={[0.07, 2.3, 0.07]} c="#475569" rough={0.4} />
      ))}
      {[0.32, 1.67].map((y, i) => (
        <group key={y}>
          <B p={[0, y, 0]} s={[1.05, 0.08, 2.1]} c="#475569" />
          <B p={[0, y + 0.13, 0]} s={[0.95, 0.18, 2.0]} c="#f1f5f9" />
          <B p={[0, y + 0.24, 0.25]} s={[0.97, 0.06, 1.45]} c={i === 0 ? blanket : top} />
          <B p={[0, y + 0.28, -0.8]} s={[0.6, 0.12, 0.35]} c="#ffffff" />
        </group>
      ))}
      <B p={[0.55, 1.2, 0.7]} s={[0.04, 0.9, 0.5]} c="#64748b" />
    </group>
  );
}

function CeilingFan() {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 6;
  });
  return (
    <group position={[0, ROOM.h - 0.1, -0.5]}>
      <Cyl p={[0, -0.2, 0]} r={0.03} h={0.4} c="#9ca3af" />
      <group ref={ref} position={[0, -0.42, 0]}>
        <Cyl p={[0, 0, 0]} r={0.12} h={0.1} c="#e5e7eb" />
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((a) => (
          <B key={a} p={[Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55]} r={[0, -a, 0]} s={[0.9, 0.02, 0.16]} c="#e5e7eb" />
        ))}
      </group>
    </group>
  );
}

function HostelRoom({ sky, primary }: { sky: string; primary: string }) {
  return (
    <>
      <Shell wall="#cfe3dc" floor="#b9a99a" />
      <BunkBed x={-3.8} blanket={primary} top="#f59e0b" />
      <BunkBed x={3.8} blanket="#22c55e" top="#3b82f6" />
      <BackWindow x={0} sky={sky} />
      {/* desk with bread, tea and books */}
      <Table x={0} z={-3.35} w={1.8} d={0.8} c="#8b5a2b" />
      <Chair x={0} z={-2.3} heading={Math.PI} c="#2563eb" />
      <B p={[-0.5, 0.86, -3.4]} s={[0.4, 0.14, 0.24]} c="#d97706" />
      <Cyl p={[0.1, 0.85, -3.3]} r={0.07} h={0.15} c="#f8fafc" />
      <B p={[0.6, 0.83, -3.5]} s={[0.35, 0.1, 0.26]} c="#7c3aed" />
      {/* wardrobe, bucket, rug, speaker */}
      <B p={[4.45, 1.15, 2.2]} s={[1, 2.3, 1.6]} c="#78350f" />
      <B p={[3.94, 1.15, 2.2]} s={[0.02, 2.2, 0.02]} c="#1f2937" />
      <Cyl p={[-4.2, 0.22, 2.7]} r={0.28} h={0.44} c="#2563eb" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.5, 0.01, 0.6]}>
        <circleGeometry args={[1.5, 32]} />
        <meshStandardMaterial color="#b45309" roughness={1} />
      </mesh>
      <Chair x={-0.8} z={1.3} heading={0.6} c="#ef4444" />
      <Chair x={2} z={1.2} heading={-0.7} c="#ef4444" />
      <B p={[2.4, 0.35, -0.3]} s={[0.4, 0.7, 0.4]} c="#111827" />
      <WallText text="Room 12 · Block C" p={[-4.94, 2.6, 2.2]} w={1.6} bg="#1e293b" fg="#fbbf24" />
      <CeilingFan />
    </>
  );
}

function CafeteriaRoom({ secondary }: { secondary: string }) {
  return (
    <>
      <Shell wall="#f3dcc0" floor="#c9b79c" />
      <B p={[0, 0.5, -3.3]} s={[7, 1, 0.9]} c="#9a3412" />
      <B p={[0, 1.02, -3.3]} s={[7.1, 0.06, 1]} c="#e5e7eb" rough={0.3} />
      {[
        [-2.4, "#b91c1c"],
        [-0.8, "#a16207"],
        [0.8, "#15803d"],
        [2.4, "#c2410c"],
      ].map(([x, food]) => (
        <group key={x as number} position={[x as number, 1.05, -3.3]}>
          <Cyl p={[0, 0.18, 0]} r={0.3} h={0.36} c="#9ca3af" />
          <Cyl p={[0, 0.37, 0]} r={0.26} h={0.03} c={food as string} />
        </group>
      ))}
      <WallText text="TODAY: JOLLOF · EBA · BEANS · PLANTAIN" p={[0, 2.5, -3.93]} w={5.5} bg={secondary} fg="#111827" />
      {[-2, 2].map((x) => (
        <group key={x}>
          <Table x={x} z={0} c="#f5f5f4" />
          <Chair x={x} z={0.9} heading={Math.PI} />
          <Chair x={x} z={-0.9} />
          <Cyl p={[x, 0.79, 0.25]} r={0.2} h={0.02} c="#ffffff" />
          <Cyl p={[x, 0.81, 0.25]} r={0.14} h={0.03} c="#c2410c" />
        </group>
      ))}
      <Table x={0} z={2.4} c="#f5f5f4" />
      <Chair x={-0.6} z={3.1} heading={Math.PI} />
      <Chair x={0.6} z={3.1} heading={Math.PI} />
    </>
  );
}

/** Book spines drawn as one instanced mesh with a colour per book. */
function Books({ rows }: { rows: { x: number; y: number; z: number; w: number; rotY: number }[] }) {
  const ref = useRef<InstancedMesh>(null);
  const items = useMemo(() => {
    const rand = seededRandom(77);
    const palette = ["#7f1d1d", "#1e3a8a", "#065f46", "#78350f", "#4c1d95", "#9a3412", "#0f766e"];
    const out: { p: V3; s: V3; rotY: number; c: string }[] = [];
    for (const row of rows) {
      let off = -row.w / 2;
      while (off < row.w / 2 - 0.1) {
        const t = 0.06 + rand() * 0.06;
        const h = 0.28 + rand() * 0.12;
        const along = off + t / 2;
        out.push({
          p: [row.x + Math.cos(row.rotY) * along, row.y + h / 2, row.z - Math.sin(row.rotY) * along],
          s: [t, h, 0.22],
          rotY: row.rotY,
          c: palette[Math.floor(rand() * palette.length)],
        });
        off += t + 0.01;
      }
    }
    return out;
  }, [rows]);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new Object3D();
    const col = new Color();
    items.forEach((b, i) => {
      o.position.set(...b.p);
      o.rotation.set(0, b.rotY, 0);
      o.scale.set(...b.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, col.set(b.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [items]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
  );
}

function LibraryRoom({ primary }: { primary: string }) {
  const shelfY = [0.15, 0.75, 1.35, 1.95];
  const rows = useMemo(() => {
    const out: { x: number; y: number; z: number; w: number; rotY: number }[] = [];
    for (const x of [-3, 0, 3]) for (const y of shelfY) out.push({ x, y: y + 0.03, z: -3.6, w: 2.5, rotY: 0 });
    for (const z of [-1.2, 1.6]) for (const y of shelfY) out.push({ x: -4.6, y: y + 0.03, z, w: 2.3, rotY: Math.PI / 2 });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <Shell wall="#e8dcc4" floor="#8b6a4a" />
      {[-3, 0, 3].map((x) => (
        <group key={x}>
          <B p={[x, 1.25, -3.75]} s={[2.7, 2.5, 0.1]} c="#5b3a1e" />
          {shelfY.map((y) => (
            <B key={y} p={[x, y, -3.6]} s={[2.7, 0.05, 0.4]} c="#6b4423" />
          ))}
        </group>
      ))}
      {[-1.2, 1.6].map((z) => (
        <group key={z}>
          <B p={[-4.85, 1.25, z]} s={[0.1, 2.5, 2.5]} c="#5b3a1e" />
          {shelfY.map((y) => (
            <B key={y} p={[-4.7, y, z]} s={[0.4, 0.05, 2.5]} c="#6b4423" />
          ))}
        </group>
      ))}
      <Books rows={rows} />
      {[-1.5, 1.5].map((x) => (
        <group key={x}>
          <Table x={x} z={0} w={1.8} c="#6b4423" />
          <Chair x={x} z={0.9} heading={Math.PI} />
          <Chair x={x} z={-0.9} />
          <Cyl p={[x - 0.6, 0.95, -0.2]} r={0.03} h={0.35} c="#a16207" />
          <B p={[x - 0.6, 1.12, -0.15]} s={[0.3, 0.06, 0.18]} c="#15803d" e={0.6} />
          <B p={[x, 0.79, 0.2]} s={[0.5, 0.03, 0.34]} c="#f8fafc" />
        </group>
      ))}
      <WallText text="SILENCE PLEASE" p={[4.94, 2.5, 0]} w={2.4} bg={primary} fg="#ffffff" />
    </>
  );
}

function FacultyRoom({ primary }: { primary: string }) {
  return (
    <>
      <Shell wall="#e5e7eb" floor="#9ca3af" />
      <B p={[0, 1.8, -3.92]} s={[4.4, 1.6, 0.06]} c="#9ca3af" />
      <WallText text="CSC 101 · Introduction to Computing" p={[0, 1.8, -3.87]} w={4.2} bg="#ffffff" fg="#1e293b" />
      <Table x={-3} z={-2.7} w={1.6} d={0.8} c={primary} />
      {[-2.6, -0.6, 1.4].map((x) =>
        [-1.2, 0.2].map((z) => (
          <group key={`${x}${z}`}>
            <Table x={x} z={z} w={1.2} d={0.55} h={0.72} c="#d6d3d1" />
            <Chair x={x} z={z + 0.6} heading={Math.PI} c="#1e40af" />
          </group>
        ))
      )}
      <B p={[4.94, 1.8, 1.2]} s={[0.04, 1.2, 1.8]} c="#a16207" />
      {[
        [0.7, "#fde047"],
        [1.3, "#f9a8d4"],
        [1.7, "#93c5fd"],
      ].map(([z, c]) => (
        <B key={z as number} p={[4.9, 1.9, z as number]} s={[0.02, 0.4, 0.35]} c={c as string} />
      ))}
    </>
  );
}

function DanceFloor() {
  const tiles = useRef<(Mesh | null)[]>([]);
  const colors = useMemo(() => ["#e879f9", "#22d3ee", "#facc15", "#f43f5e"].map((c) => new Color(c)), []);
  useFrame((state) => {
    const t = Math.floor(state.clock.elapsedTime * 2.5);
    tiles.current.forEach((m, i) => {
      if (!m) return;
      const mat = m.material as MeshStandardMaterial;
      const c = colors[(i + t + (i % 3)) % colors.length];
      mat.color.copy(c);
      mat.emissive.copy(c);
    });
  });
  const cells: [number, number][] = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) cells.push([-1.35 + i * 0.9, -1.15 + j * 0.9]);
  return (
    <>
      {cells.map(([x, z], i) => (
        <mesh
          key={i}
          ref={(m) => {
            tiles.current[i] = m;
          }}
          position={[x, 0.04, z]}
        >
          <boxGeometry args={[0.86, 0.08, 0.86]} />
          <meshStandardMaterial emissiveIntensity={0.9} roughness={0.3} />
        </mesh>
      ))}
    </>
  );
}

function ClubRoom() {
  return (
    <>
      <Shell wall="#1a1426" floor="#111018" />
      <DanceFloor />
      <B p={[0, 0.55, -3.3]} s={[2.6, 1.1, 0.9]} c="#27272a" />
      <Cyl p={[-0.6, 1.13, -3.3]} r={0.28} h={0.04} c="#18181b" />
      <Cyl p={[0.6, 1.13, -3.3]} r={0.28} h={0.04} c="#18181b" />
      <B p={[0, 0.55, -2.84]} s={[2.6, 0.1, 0.02]} c="#e879f9" e={2} />
      {[-4.2, 4.2].map((x) => (
        <group key={x}>
          <B p={[x, 0.9, -3.3]} s={[0.9, 1.8, 0.8]} c="#18181b" />
          <Cyl p={[x, 1.25, -2.89]} r={0.28} h={0.02} c="#3f3f46" />
          <Cyl p={[x, 0.55, -2.89]} r={0.2} h={0.02} c="#3f3f46" />
        </group>
      ))}
      <B p={[-4.3, 0.55, 1]} s={[0.9, 1.1, 3]} c="#3b0764" />
      <B p={[-4.3, 1.12, 1]} s={[1, 0.05, 3.1]} c="#a855f7" e={1.5} />
      {[0.1, 0.6, 1.1, 1.6].map((z, i) => (
        <Cyl key={z} p={[-4.3, 1.3, z]} r={0.06} h={0.3} c={["#22c55e", "#f59e0b", "#ef4444", "#38bdf8"][i]} />
      ))}
      <WallText text="CLUB HOUSE" p={[0, 2.7, -3.93]} w={3} bg="#7e22ce" fg="#ffffff" />
    </>
  );
}

function HealthRoom() {
  return (
    <>
      <Shell wall="#eef6f8" floor="#cbd5e1" />
      {/* examination couch */}
      <B p={[-2.6, 0.32, -1.0]} s={[2.0, 0.64, 0.9]} c="#64748b" />
      <B p={[-2.6, 0.68, -1.0]} s={[2.0, 0.08, 0.9]} c="#0ea5e9" />
      <B p={[-3.45, 0.85, -1.0]} s={[0.4, 0.2, 0.7]} c="#ffffff" />
      <B p={[-2.6, 2.2, -1.9]} s={[2.4, 0.04, 0.04]} c="#94a3b8" />
      <B p={[-1.6, 1.2, -1.9]} s={[0.6, 2.0, 0.03]} c="#bae6fd" />
      {/* doctor's desk */}
      <Table x={2.8} z={-2.4} w={1.8} d={0.9} c="#e2e8f0" />
      <Chair x={2.8} z={-3.2} c="#0f172a" />
      <B p={[2.8, 1.05, -2.6]} s={[0.6, 0.4, 0.05]} c="#0f172a" e={0.2} />
      <B p={[4.5, 1.0, 0.8]} s={[0.8, 2, 1.2]} c="#f8fafc" />
      <B p={[4.08, 1.6, 0.8]} s={[0.02, 0.5, 0.16]} c="#dc2626" />
      <B p={[4.08, 1.6, 0.8]} s={[0.02, 0.16, 0.5]} c="#dc2626" />
      <WallText text="HEALTH CENTRE · Wash your hands" p={[0, 2.7, -3.93]} w={4.2} bg="#dc2626" fg="#ffffff" />
    </>
  );
}

// ---------- Player inside a room ----------

function InteriorPlayer({ avatar, spot }: { avatar: WorldAvatar; spot: Spot }) {
  const group = useRef<Group>(null);
  const shadow = useRef<Mesh>(null);
  const pos = useRef({ x: spot.x, y: spot.y, z: spot.z, heading: spot.heading });
  const [pose, setPose] = useState<Pose>(spot.pose);
  const poseRef = useRef<Pose>(spot.pose);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const p = pos.current;
    const dx = spot.x - p.x;
    const dz = spot.z - p.z;
    const dist = Math.hypot(dx, dz);
    let next: Pose;

    if (dist > 0.05) {
      // Walk on the floor towards the spot.
      p.y += (0 - p.y) * (1 - Math.exp(-dt * 12));
      const step = Math.min(dist, 2.6 * dt);
      p.x += (dx / dist) * step;
      p.z += (dz / dist) * step;
      let diff = Math.atan2(dx, dz) - p.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      p.heading += diff * (1 - Math.exp(-dt * 12));
      next = "walk";
    } else {
      p.x = spot.x;
      p.z = spot.z;
      p.y += (spot.y - p.y) * (1 - Math.exp(-dt * 10));
      let diff = spot.heading - p.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      p.heading += diff * (1 - Math.exp(-dt * 8));
      next = spot.pose;
    }

    if (next !== poseRef.current) {
      poseRef.current = next;
      setPose(next);
    }
    if (group.current) {
      group.current.position.set(p.x, p.y, p.z);
      group.current.rotation.y = p.heading;
    }
    if (shadow.current) shadow.current.position.set(p.x, 0.015, p.z);
  });

  return (
    <>
      <group ref={group}>
        <Avatar3D
          skin={avatar.skin}
          hairStyle={avatar.hairStyle}
          hairColor={avatar.hairColor}
          outfit={avatar.outfit}
          action={pose}
        />
      </group>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.4, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} />
      </mesh>
    </>
  );
}

/** Keeps the whole room in view on wide screens and tall phones. */
function CameraRig() {
  useFrame(({ camera, size }) => {
    const aspect = size.width / Math.max(1, size.height);
    const half = Math.tan((40 * Math.PI) / 360);
    const fit = (ROOM.w / 2 + 0.3) / (half * aspect);
    const dist = Math.max(6.5, Math.min(19, fit));
    camera.position.set(0, 3.3 + dist * 0.18, ROOM.d / 2 + dist);
    camera.lookAt(0, 1.1, -0.6);
  });
  return null;
}

export default function InteriorScene({
  kind,
  avatar,
  spot,
  hour,
  primary,
  secondary,
}: {
  kind: string;
  avatar: WorldAvatar;
  spot: Spot;
  hour: number;
  primary: string;
  secondary: string;
}) {
  const light = lightingFor(hour);
  const club = kind === "clubhouse";
  const night = light.lamp;

  return (
    <Canvas dpr={[1, 1.5]} camera={{ fov: 40, near: 0.1, far: 80 }} gl={{ antialias: true }}>
      <color attach="background" args={[club ? "#05030a" : "#0b1020"]} />
      <ambientLight intensity={club ? 0.25 : 0.45 + light.ambient * 0.3} />
      <hemisphereLight args={[club ? "#7e22ce" : light.sky, "#3f3f46", club ? 0.3 : 0.5]} />
      <pointLight
        position={[0, ROOM.h - 0.3, 0.5]}
        intensity={club ? 6 : night ? 22 : 12}
        color={club ? "#e879f9" : "#ffe7b8"}
        decay={2}
      />
      <directionalLight position={[3, 6, 8]} intensity={club ? 0.3 : light.sun * 0.6} color={light.sunColor} />
      {club && <pointLight position={[0, 2.5, -2]} intensity={10} color="#22d3ee" decay={2} />}

      {kind === "hostel" && <HostelRoom sky={light.sky} primary={primary} />}
      {kind === "cafeteria" && <CafeteriaRoom secondary={secondary} />}
      {kind === "library" && <LibraryRoom primary={primary} />}
      {kind === "faculty" && <FacultyRoom primary={primary} />}
      {kind === "clubhouse" && <ClubRoom />}
      {kind === "health" && <HealthRoom />}

      <InteriorPlayer avatar={avatar} spot={spot} />
      <CameraRig />
    </Canvas>
  );
}
