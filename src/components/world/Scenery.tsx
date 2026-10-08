"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { Object3D, type InstancedMesh } from "three";
import type { GameAd } from "@/lib/game/gameTypes";
import {
  WORLD_HALF,
  campusRoads,
  entranceOf,
  mainGate,
  placeCarParks,
  footprintOf,
  obstacleOf,
  placeFacultyHalls,
  seededRandom,
  toWorld,
  type Box,
  type FacultyHall as Hall,
} from "@/lib/game/worldLayout";
import Building, { FacultyHall } from "./Buildings";
import Roads, { type PlayerCar } from "./Roads";

/**
 * The campus itself (ground, paths, trees, lamps, buildings), shared by the
 * walkable world and the 3D campus map so both always look the same.
 */

export type WorldLocation = {
  id: string;
  name: string;
  kind: string;
  map_x: number;
  map_y: number;
  has_billboard: boolean;
};

export type Placed = WorldLocation & {
  x: number;
  z: number;
  entrance: { x: number; z: number };
};

type Point = { x: number; z: number };

function distanceToSegment(px: number, pz: number, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2));
  return Math.hypot(px - (a.x + t * dx), pz - (a.z + t * dz));
}

/** Where everything goes, worked out once from the locations in the database. */
export function useCampusLayout(locations: WorldLocation[], faculties: string[] = []) {
  const placed: Placed[] = useMemo(
    () =>
      locations.map((l) => {
        const { x, z } = toWorld(l.map_x, l.map_y);
        return { ...l, x, z, entrance: entranceOf(l.kind, x, z) };
      }),
    [locations]
  );

  const paths = useMemo(() => {
    const hub = placed.find((p) => p.kind === "faculty") ?? placed[0];
    return hub
      ? placed.filter((p) => p.id !== hub.id).map((p) => ({ from: hub.entrance, to: p.entrance }))
      : [];
  }, [placed]);

  // A ring road round the campus and a road out of the main gate.
  const roads = useMemo(() => campusRoads(placed), [placed]);

  // Car parks by the main gate and the Faculty Block.
  const parks = useMemo(() => {
    const blockers: Box[] = placed.map((p) => {
      const f = footprintOf(p.kind);
      return { minX: p.x - f.w / 2 - 2, maxX: p.x + f.w / 2 + 2, minZ: p.z - f.d / 2 - 2, maxZ: p.z + f.d / 2 + 2 };
    });
    // Keep the glowing entrance circles and the space in front of them clear.
    for (const p of placed) {
      blockers.push({ minX: p.entrance.x - 7, maxX: p.entrance.x + 7, minZ: p.entrance.z - 5, maxZ: p.entrance.z + 7 });
    }
    for (const p of placed.filter((q) => q.has_billboard)) {
      const f = footprintOf(p.kind);
      const bx = p.x + f.w / 2 + 3;
      const bz = p.z + f.d / 2;
      blockers.push({ minX: bx - 4, maxX: bx + 4, minZ: bz - 2, maxZ: bz + 2 });
    }
    const targets = ["market", "faculty"]
      .map((k) => placed.find((p) => p.kind === k)?.entrance)
      .filter((t): t is Point => Boolean(t));
    return placeCarParks(targets, blockers, [...paths, ...roads]);
  }, [placed, paths, roads]);

  // One building per faculty, around the main Faculty Block.
  const halls: (Hall & { facing: number })[] = useMemo(() => {
    const hub = placed.find((p) => p.kind === "faculty");
    if (!hub || faculties.length === 0) return [];
    const blockers: Box[] = placed.map((p) => {
      const f = footprintOf(p.kind);
      return { minX: p.x - f.w / 2, maxX: p.x + f.w / 2, minZ: p.z - f.d / 2, maxZ: p.z + f.d / 2 };
    });
    // Billboards stand beside their building; keep them clear too.
    for (const p of placed.filter((q) => q.has_billboard)) {
      const f = footprintOf(p.kind);
      const bx = p.x + f.w / 2 + 3;
      const bz = p.z + f.d / 2;
      blockers.push({ minX: bx - 4, maxX: bx + 4, minZ: bz - 2, maxZ: bz + 2 });
    }
    for (const k of parks) {
      blockers.push({ minX: k.x - k.w / 2 - 1, maxX: k.x + k.w / 2 + 1, minZ: k.z - k.d / 2 - 1, maxZ: k.z + k.d / 2 + 1 });
    }
    return placeFacultyHalls(hub, faculties, blockers, [...paths, ...roads]).map((h) => ({
      ...h,
      facing: Math.atan2(hub.x - h.x, hub.z - h.z),
    }));
  }, [placed, faculties, paths, roads, parks]);

  const obstacles = useMemo(() => {
    const boxes = placed.map((p) => obstacleOf(p.kind, p.x, p.z)).filter((b): b is Box => b !== null);
    // Halls are turned to face the Faculty Block, so block a square that covers any angle.
    for (const h of halls) {
      const r = Math.max(h.w, h.d) / 2;
      boxes.push({ minX: h.x - r, maxX: h.x + r, minZ: h.z - r, maxZ: h.z + r });
    }
    return boxes;
  }, [placed, halls]);

  const lamps = useMemo(() => {
    const out: Point[] = [];
    for (const path of paths) {
      const dx = path.to.x - path.from.x;
      const dz = path.to.z - path.from.z;
      const len = Math.hypot(dx, dz);
      const nx = -dz / (len || 1);
      const nz = dx / (len || 1);
      for (let d = 8; d < len - 6; d += 16) {
        out.push({ x: path.from.x + (dx / len) * d + nx * 2.4, z: path.from.z + (dz / len) * d + nz * 2.4 });
      }
    }
    return out;
  }, [paths]);

  const trees = useMemo(() => {
    const rand = seededRandom(1234);
    const out: { x: number; z: number; s: number }[] = [];
    for (let tries = 0; tries < 900 && out.length < 90; tries++) {
      const x = (rand() * 2 - 1) * (WORLD_HALF - 4);
      const z = (rand() * 2 - 1) * (WORLD_HALF - 4);
      const nearBuilding = placed.some((p) => {
        const f = footprintOf(p.kind);
        return Math.abs(x - p.x) < f.w / 2 + 4 && Math.abs(z - p.z) < f.d / 2 + 8;
      });
      if (nearBuilding) continue;
      if (halls.some((h) => Math.abs(x - h.x) < h.w / 2 + 4 && Math.abs(z - h.z) < h.d / 2 + 4)) continue;
      if (paths.some((path) => distanceToSegment(x, z, path.from, path.to) < 4)) continue;
      if (roads.some((r) => distanceToSegment(x, z, r.from, r.to) < r.width / 2 + 2.5)) continue;
      if (parks.some((k) => Math.abs(x - k.x) < k.w / 2 + 3 && Math.abs(z - k.z) < k.d / 2 + 3)) continue;
      out.push({ x, z, s: 0.8 + rand() * 0.6 });
    }
    return out;
  }, [placed, paths, halls, roads, parks]);

  const gate = useMemo(() => mainGate(roads), [roads]);

  return { placed, obstacles, paths, lamps, trees, halls, roads, parks, gate };
}

export function Ground({ onPoint }: { onPoint?: (x: number, z: number) => void }) {
  function click(e: ThreeEvent<MouseEvent>) {
    if (!onPoint) return;
    e.stopPropagation();
    onPoint(e.point.x, e.point.z);
  }
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={click}>
      <planeGeometry args={[WORLD_HALF * 2 + 60, WORLD_HALF * 2 + 60]} />
      <meshStandardMaterial color="#5f8f3e" roughness={1} />
    </mesh>
  );
}

function Path({ from, to }: { from: Point; to: Point }) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  return (
    <mesh
      position={[(from.x + to.x) / 2, 0.02, (from.z + to.z) / 2]}
      rotation={[-Math.PI / 2, 0, -Math.atan2(dx, dz)]}
      receiveShadow
    >
      <planeGeometry args={[3, length + 3]} />
      <meshStandardMaterial color="#c8b48a" roughness={1} />
    </mesh>
  );
}

/** Trees drawn as two instanced meshes (trunks and leaves), so they are cheap to render. */
function Trees({ spots }: { spots: { x: number; z: number; s: number }[] }) {
  const trunks = useRef<InstancedMesh>(null);
  const leaves = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const o = new Object3D();
    spots.forEach((t, i) => {
      o.position.set(t.x, 1 * t.s, t.z);
      o.scale.set(t.s, t.s, t.s);
      o.updateMatrix();
      trunks.current?.setMatrixAt(i, o.matrix);
      o.position.set(t.x, 3.2 * t.s, t.z);
      o.updateMatrix();
      leaves.current?.setMatrixAt(i, o.matrix);
    });
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true;
    if (leaves.current) leaves.current.instanceMatrix.needsUpdate = true;
  }, [spots]);

  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, spots.length]} castShadow>
        <cylinderGeometry args={[0.22, 0.32, 2, 6]} />
        <meshStandardMaterial color="#6b4423" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={leaves} args={[undefined, undefined, spots.length]} castShadow>
        <icosahedronGeometry args={[1.8, 0]} />
        <meshStandardMaterial color="#2f6b2a" roughness={0.9} flatShading />
      </instancedMesh>
    </>
  );
}

function Lamps({ spots, night }: { spots: Point[]; night: boolean }) {
  return (
    <>
      {spots.map((l, i) => (
        <group key={i} position={[l.x, 0, l.z]}>
          <mesh position={[0, 1.8, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.1, 3.6, 6]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
          <mesh position={[0, 3.7, 0]}>
            <sphereGeometry args={[0.25, 10, 8]} />
            <meshStandardMaterial
              color={night ? "#fff1c1" : "#e5e7eb"}
              emissive="#ffd27a"
              emissiveIntensity={night ? 4 : 0}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Pick which billboard shows which ad, so different billboards show different ads. */
export function billboardAds(placed: Placed[], ads: GameAd[], rotation: number): Map<string, GameAd> {
  const boards = placed.filter((p) => p.has_billboard);
  const billboards = ads.filter((a) => a.placement === "billboard");
  const out = new Map<string, GameAd>();
  if (billboards.length === 0) return out;
  boards.forEach((b, i) => out.set(b.id, billboards[(i + rotation) % billboards.length]));
  return out;
}

export function CampusBase({
  layout,
  primary,
  secondary,
  night,
  ads,
  adRotation,
  onGround,
  onSelectBuilding,
  onSelectAd,
  myFaculty = null,
  playerCars = [],
}: {
  layout: ReturnType<typeof useCampusLayout>;
  primary: string;
  secondary: string;
  night: boolean;
  ads: GameAd[];
  adRotation: number;
  onGround?: (x: number, z: number) => void;
  onSelectBuilding: (p: Placed) => void;
  onSelectAd: (ad: GameAd) => void;
  /** Your own faculty, highlighted in the faculty district. */
  myFaculty?: string | null;
  playerCars?: PlayerCar[];
}) {
  const hub = layout.placed.find((p) => p.kind === "faculty") ?? null;
  const boards = billboardAds(layout.placed, ads, adRotation);
  const products = ads.filter((a) => a.placement === "market_product");
  return (
    <>
      <Ground onPoint={onGround} />
      {layout.paths.map((p, i) => (
        <Path key={i} from={p.from} to={p.to} />
      ))}
      <Roads roads={layout.roads} parks={layout.parks} gate={layout.gate} night={night} primary={primary} playerCars={playerCars} />
      <Trees spots={layout.trees} />
      <Lamps spots={layout.lamps} night={night} />
      {layout.placed.map((p) => (
        <Building
          key={p.id}
          kind={p.kind}
          name={p.name}
          x={p.x}
          z={p.z}
          primary={primary}
          secondary={secondary}
          night={night}
          billboard={p.has_billboard}
          billboardAd={boards.get(p.id) ?? null}
          products={p.kind === "market" ? products : []}
          onSelect={() => onSelectBuilding(p)}
          onSelectAd={onSelectAd}
        />
      ))}
      {layout.halls.map((h, i) => (
        <FacultyHall
          key={h.name}
          name={h.name}
          x={h.x}
          z={h.z}
          w={h.w}
          d={h.d}
          h={h.h}
          facing={h.facing}
          index={i}
          primary={primary}
          secondary={secondary}
          night={night}
          mine={h.name === myFaculty}
          onSelect={() => hub && onSelectBuilding(hub)}
        />
      ))}
    </>
  );
}
