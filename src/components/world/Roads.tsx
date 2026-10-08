"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { RING, type CarPark, type Road } from "@/lib/game/worldLayout";
import { makeLabelTexture } from "./labels";

/** Car paint colours, by index (parked cars now, players' own cars later). */
export const CAR_COLORS = ["#dc2626", "#2563eb", "#f8fafc", "#111827", "#9ca3af", "#16a34a", "#f59e0b", "#7c3aed"];

/** A simple low-poly car, 4.2 long, facing +z. */
export function Car({
  color,
  lights = false,
  model = "sedan",
}: {
  color: string;
  lights?: boolean;
  model?: "sedan" | "suv";
}) {
  const suv = model === "suv";
  return (
    <group>
      <mesh position={[0, suv ? 0.75 : 0.55, 0]} castShadow>
        <boxGeometry args={[suv ? 2.05 : 1.9, suv ? 0.9 : 0.6, 4.2]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.3} />
      </mesh>
      <mesh position={[0, suv ? 1.55 : 1.08, suv ? -0.35 : -0.25]} castShadow>
        <boxGeometry args={suv ? [1.95, 0.75, 2.9] : [1.6, 0.5, 2.1]} />
        <meshStandardMaterial color="#1e293b" roughness={0.2} metalness={0.5} />
      </mesh>
      {[
        [-0.9, 1.35],
        [0.9, 1.35],
        [-0.9, -1.35],
        [0.9, -1.35],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.33, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.33, 0.33, 0.25, 12]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
        </mesh>
      ))}
      {lights && (
        <mesh position={[0, 0.6, 2.11]}>
          <boxGeometry args={[1.5, 0.15, 0.02]} />
          <meshStandardMaterial color="#fff7d6" emissive="#fff1b0" emissiveIntensity={3} />
        </mesh>
      )}
    </group>
  );
}

/** Asphalt with a yellow centre line. */
function RoadStrip({ road }: { road: Road }) {
  const dx = road.to.x - road.from.x;
  const dz = road.to.z - road.from.z;
  const length = Math.hypot(dx, dz);
  const angle = -Math.atan2(dx, dz);
  const mid: [number, number, number] = [(road.from.x + road.to.x) / 2, 0.03, (road.from.z + road.to.z) / 2];
  return (
    <group position={mid} rotation={[-Math.PI / 2, 0, angle]}>
      <mesh receiveShadow>
        <planeGeometry args={[road.width, length + road.width]} />
        <meshStandardMaterial color="#3f3f46" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[0.18, length]} />
        <meshBasicMaterial color="#facc15" />
      </mesh>
    </group>
  );
}

export type PlayerCar = { id: string; owner: string; color: string; model: "sedan" | "suv" };

/** Every bay in a car park, row by row. */
function bays(park: CarPark) {
  const out: { x: number; z: number; heading: number }[] = [];
  for (const row of [-1, 1]) {
    for (let i = 0; i < 5; i++) out.push({ x: park.x - 6 + i * 3, z: park.z + row * 2.6, heading: row < 0 ? 0 : Math.PI });
  }
  return out;
}

function OwnerTag({ name }: { name: string }) {
  const label = useMemo(() => makeLabelTexture(`🚗 ${name}`, { width: 384, accent: "#34d399" }), [name]);
  useEffect(() => () => label.texture.dispose(), [label]);
  return (
    <sprite position={[0, 2.6, 0]} scale={[0.45 * label.aspect, 0.45, 1]}>
      <spriteMaterial map={label.texture} depthWrite={false} transparent />
    </sprite>
  );
}

function ParkingLot({ park, night, owned = [] }: { park: CarPark; night: boolean; owned?: PlayerCar[] }) {
  // Players' own cars take the first bays; the other parked cars fill the rest.
  const spots = bays(park);
  const mine = owned.slice(0, spots.length).map((c, i) => ({ car: c, at: spots[i] }));
  const used = new Set(mine.map((m) => `${m.at.x},${m.at.z}`));
  const decor = park.cars.filter((c) => !used.has(`${c.x},${c.z}`));
  const sign = useMemo(() => makeLabelTexture("P  PARKING", { accent: "#38bdf8", width: 512 }), []);
  useEffect(() => () => sign.texture.dispose(), [sign]);
  return (
    <group>
      <mesh position={[park.x, 0.035, park.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[park.w, park.d]} />
        <meshStandardMaterial color="#52525b" roughness={0.95} />
      </mesh>
      {/* bay lines */}
      {Array.from({ length: 6 }, (_, i) => park.x - 7.5 + i * 3).map((x) =>
        [-1, 1].map((row) => (
          <mesh key={`${x}${row}`} position={[x, 0.045, park.z + row * 2.6]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.12, 4.4]} />
            <meshBasicMaterial color="#f4f4f5" />
          </mesh>
        ))
      )}
      {mine.map(({ car, at }) => (
        <group key={car.id} position={[at.x, 0, at.z]} rotation={[0, at.heading, 0]}>
          <Car color={car.color} model={car.model} lights={night} />
          <group rotation={[0, -at.heading, 0]}>
            <OwnerTag name={car.owner} />
          </group>
        </group>
      ))}
      {decor.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} rotation={[0, c.heading, 0]}>
          <Car color={CAR_COLORS[c.color % CAR_COLORS.length]} lights={night && i % 3 === 0} />
        </group>
      ))}
      <group position={[park.x - park.w / 2 - 0.6, 0, park.z - park.d / 2]}>
        <mesh position={[0, 1.3, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 2.6, 6]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
        <sprite position={[0, 2.9, 0]} scale={[0.7 * sign.aspect, 0.7, 1]}>
          <spriteMaterial map={sign.texture} depthWrite={false} />
        </sprite>
      </group>
    </group>
  );
}

/** A few cars driving round the ring road. Only drawn, never sent anywhere. */
function TrafficOnRing({ night }: { night: boolean }) {
  const cars = useRef<(Group | null)[]>([]);
  const perimeter = RING * 8;
  const fleet = useMemo(() => [0, 0.27, 0.55, 0.8].map((offset, i) => ({ offset, color: CAR_COLORS[(i * 3 + 1) % 8] })), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    fleet.forEach((car, i) => {
      const g = cars.current[i];
      if (!g) return;
      // Distance travelled round the square, driving on the left-hand lane side by side.
      let d = ((t * 9 + car.offset * perimeter) % perimeter + perimeter) % perimeter;
      const side = Math.floor(d / (RING * 2));
      d -= side * RING * 2;
      const lane = RING - 1.7;
      const p = -RING + d;
      const at = [
        { x: p, z: -lane, h: Math.PI / 2 },
        { x: lane, z: p, h: 0 },
        { x: -p, z: lane, h: -Math.PI / 2 },
        { x: -lane, z: -p, h: Math.PI },
      ][side];
      g.position.set(at.x, 0, at.z);
      g.rotation.y = at.h;
    });
  });

  return (
    <>
      {fleet.map((car, i) => (
        <group
          key={i}
          ref={(g) => {
            cars.current[i] = g;
          }}
        >
          <Car color={car.color} lights={night} />
        </group>
      ))}
    </>
  );
}

/** The main gate arch where the gate road meets the ring road. */
function GateArch({ gate, primary }: { gate: { x: number; z: number; across: boolean }; primary: string }) {
  const label = useMemo(() => makeLabelTexture("MAIN GATE", { accent: primary, width: 512 }), [primary]);
  useEffect(() => () => label.texture.dispose(), [label]);
  const half = 4.2;
  return (
    <group position={[gate.x, 0, gate.z]} rotation={[0, gate.across ? 0 : Math.PI / 2, 0]}>
      {[-half, half].map((z) => (
        <mesh key={z} position={[0, 2.5, z]} castShadow>
          <boxGeometry args={[0.8, 5, 0.8]} />
          <meshStandardMaterial color="#e5e7eb" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 5.2, 0]} castShadow>
        <boxGeometry args={[0.9, 0.8, half * 2 + 0.8]} />
        <meshStandardMaterial color={primary} roughness={0.7} />
      </mesh>
      <sprite position={[0, 6.4, 0]} scale={[1.2 * label.aspect, 1.2, 1]}>
        <spriteMaterial map={label.texture} depthWrite={false} />
      </sprite>
    </group>
  );
}

export default function Roads({
  roads,
  parks,
  gate,
  night,
  primary,
  playerCars = [],
}: {
  roads: Road[];
  parks: CarPark[];
  gate: { x: number; z: number; across: boolean } | null;
  night: boolean;
  primary: string;
  /** Cars owned by you and the people you can see, parked by the main gate. */
  playerCars?: PlayerCar[];
}) {
  return (
    <>
      {roads.map((r, i) => (
        <RoadStrip key={i} road={r} />
      ))}
      {parks.map((p, i) => (
        <ParkingLot key={i} park={p} night={night} owned={i === 0 ? playerCars : []} />
      ))}
      {gate && <GateArch gate={gate} primary={primary} />}
      <TrafficOnRing night={night} />
    </>
  );
}
