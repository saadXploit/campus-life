"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  Object3D,
  type DirectionalLight,
  type Group,
  type InstancedMesh,
  type Mesh,
} from "three";
import Avatar3D, { type AvatarAction } from "@/components/scene/Avatar3D";
import { lightingFor } from "@/lib/game/lighting";
import {
  PLAYER_RADIUS,
  WORLD_HALF,
  ZONE_RADIUS,
  entranceOf,
  footprintOf,
  obstacleOf,
  resolveCollision,
  seededRandom,
  toWorld,
  type Box,
} from "@/lib/game/worldLayout";
import Building from "./Buildings";
import { Bubble, NameTag, OtherPlayer, type ShownPerson } from "./People";

export type WorldLocation = {
  id: string;
  name: string;
  kind: string;
  map_x: number;
  map_y: number;
  has_billboard: boolean;
};

export type WorldAvatar = { skin: number; hairStyle: number; hairColor: number; outfit: number };

/** Another player out on campus, shown near the building they are checked in at. */
export type CrowdMember = Omit<ShownPerson, "x" | "y" | "z" | "heading"> & { kind: string };

type Placed = WorldLocation & {
  x: number;
  z: number;
  entrance: { x: number; z: number };
};

type Props = {
  locations: WorldLocation[];
  primary: string;
  secondary: string;
  hour: number;
  avatar: WorldAvatar;
  playerName: string;
  /** Where the server says the player is. They appear at its entrance. */
  spawnKind: string | null;
  /** Changes when the player should be placed back at spawn (for example a new day). */
  spawnKey: string;
  /** Set while an activity or sleep is playing. Movement is locked. */
  action: AvatarAction | null;
  onZoneChange: (kind: string | null) => void;
  crowd: CrowdMember[];
  selfBubble: string | null;
  onSelectPerson: (id: string) => void;
};

const WALK_SPEED = 7;
const RUN_SPEED = 11;
const CAMERA_OFFSET = { y: 11, z: 13 };

// ---------- Static scenery ----------

function Ground({ onPoint }: { onPoint: (x: number, z: number) => void }) {
  function click(e: ThreeEvent<MouseEvent>) {
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

function Path({ from, to }: { from: { x: number; z: number }; to: { x: number; z: number } }) {
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

function distanceToSegment(
  px: number,
  pz: number,
  a: { x: number; z: number },
  b: { x: number; z: number }
): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2));
  return Math.hypot(px - (a.x + t * dx), pz - (a.z + t * dz));
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

function Lamps({ spots, night }: { spots: { x: number; z: number }[]; night: boolean }) {
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

function Zone({ x, z, active }: { x: number; z: number; active: boolean }) {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.06;
    ref.current.scale.set(s, s, s);
  });
  return (
    <mesh ref={ref} position={[x, 0.06, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[ZONE_RADIUS - 0.45, ZONE_RADIUS, 40]} />
      <meshBasicMaterial
        color={active ? "#34d399" : "#fbbf24"}
        transparent
        opacity={active ? 0.95 : 0.7}
        toneMapped={false}
      />
    </mesh>
  );
}

function SkyAndFog({ color }: { color: string }) {
  return (
    <>
      <color attach="background" args={[color]} />
      <fog attach="fog" args={[color, 70, 190]} />
    </>
  );
}

// ---------- The player ----------

function Player({
  avatar,
  name,
  spawn,
  spawnKey,
  obstacles,
  zones,
  locked,
  action,
  targetRef,
  sunColor,
  sunIntensity,
  bubble,
  onZoneChange,
}: {
  avatar: WorldAvatar;
  name: string;
  spawn: { x: number; z: number };
  spawnKey: string;
  obstacles: Box[];
  zones: { kind: string; x: number; z: number }[];
  locked: boolean;
  action: AvatarAction | null;
  targetRef: React.RefObject<{ x: number; z: number } | null>;
  sunColor: string;
  sunIntensity: number;
  bubble: string | null;
  onZoneChange: (kind: string | null) => void;
}) {
  const body = useRef<Group>(null);
  const marker = useRef<Mesh>(null);
  const sun = useRef<DirectionalLight>(null);
  const sunTarget = useMemo(() => new Object3D(), []);
  const pos = useRef({ x: spawn.x, z: spawn.z, heading: Math.PI });
  const keys = useRef(new Set<string>());
  const zoneRef = useRef<string | null>(null);
  const zoom = useRef(1);
  const [moving, setMoving] = useState(false);
  const movingRef = useRef(false);
  const getThree = useThree((s) => s.get);

  // Put the player back at spawn when the server says so (first load, new day).
  useEffect(() => {
    pos.current = { x: spawn.x, z: spawn.z, heading: Math.PI };
    targetRef.current = null;
    const { camera } = getThree();
    camera.position.set(spawn.x, CAMERA_OFFSET.y, spawn.z + CAMERA_OFFSET.z);
    camera.lookAt(spawn.x, 1, spawn.z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spawnKey]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keys.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    const wheel = (e: WheelEvent) => {
      zoom.current = Math.max(0.55, Math.min(1.8, zoom.current + e.deltaY * 0.001));
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener("wheel", wheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("wheel", wheel);
    };
  }, []);

  useFrame(({ camera }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const p = pos.current;
    const k = keys.current;

    let dx = 0;
    let dz = 0;
    if (!locked) {
      if (k.has("KeyW") || k.has("ArrowUp")) dz -= 1;
      if (k.has("KeyS") || k.has("ArrowDown")) dz += 1;
      if (k.has("KeyA") || k.has("ArrowLeft")) dx -= 1;
      if (k.has("KeyD") || k.has("ArrowRight")) dx += 1;
      if (dx || dz) {
        targetRef.current = null;
      } else if (targetRef.current) {
        const tx = targetRef.current.x - p.x;
        const tz = targetRef.current.z - p.z;
        const d = Math.hypot(tx, tz);
        if (d < 0.3) targetRef.current = null;
        else {
          dx = tx / d;
          dz = tz / d;
        }
      }
    } else {
      targetRef.current = null;
    }

    const isMoving = dx !== 0 || dz !== 0;
    if (isMoving) {
      const len = Math.hypot(dx, dz);
      const speed = k.has("ShiftLeft") || k.has("ShiftRight") ? RUN_SPEED : WALK_SPEED;
      const before = { x: p.x, z: p.z };
      const next = resolveCollision(
        p.x + (dx / len) * speed * delta,
        p.z + (dz / len) * speed * delta,
        PLAYER_RADIUS,
        obstacles
      );
      p.x = next.x;
      p.z = next.z;
      // Walking into a wall towards a tapped spot: give up instead of pushing forever.
      if (targetRef.current && Math.hypot(p.x - before.x, p.z - before.z) < speed * delta * 0.15) {
        targetRef.current = null;
      }
      const wanted = Math.atan2(dx, dz);
      let diff = wanted - p.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      p.heading += diff * (1 - Math.exp(-delta * 14));
    }

    if (isMoving !== movingRef.current) {
      movingRef.current = isMoving;
      setMoving(isMoving);
    }

    if (body.current) {
      body.current.position.set(p.x, 0, p.z);
      body.current.rotation.y = p.heading;
    }

    if (marker.current) {
      marker.current.visible = Boolean(targetRef.current);
      if (targetRef.current) marker.current.position.set(targetRef.current.x, 0.07, targetRef.current.z);
    }

    // Camera follows smoothly from behind and above.
    const z = zoom.current;
    const ck = 1 - Math.exp(-delta * 5);
    camera.position.x += (p.x - camera.position.x) * ck;
    camera.position.y += (CAMERA_OFFSET.y * z - camera.position.y) * ck;
    camera.position.z += (p.z + CAMERA_OFFSET.z * z - camera.position.z) * ck;
    camera.lookAt(p.x, 1, p.z);

    // The sun follows the player so shadows stay sharp near them.
    if (sun.current) {
      sun.current.position.set(p.x + 18, 30, p.z + 12);
      sunTarget.position.set(p.x, 0, p.z);
      sunTarget.updateMatrixWorld();
    }

    // Which glowing circle (if any) is the player standing in?
    let inZone: string | null = null;
    for (const zn of zones) {
      if (Math.hypot(zn.x - p.x, zn.z - p.z) <= ZONE_RADIUS) {
        inZone = zn.kind;
        break;
      }
    }
    if (inZone !== zoneRef.current) {
      zoneRef.current = inZone;
      onZoneChange(inZone);
    }
  });

  return (
    <>
      <primitive object={sunTarget} />
      <directionalLight
        ref={sun}
        target={sunTarget}
        color={sunColor}
        intensity={sunIntensity}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-bias={-0.0005}
      />
      <group ref={body}>
        <Avatar3D
          skin={avatar.skin}
          hairStyle={avatar.hairStyle}
          hairColor={avatar.hairColor}
          outfit={avatar.outfit}
          action={action ?? (moving ? "walk" : "idle")}
        />
        <NameTag name={name} />
        {bubble && <Bubble text={bubble} />}
      </group>
      <mesh ref={marker} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.35, 0.55, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} toneMapped={false} />
      </mesh>
    </>
  );
}

// ---------- The whole campus ----------

export default function CampusWorld({
  locations,
  primary,
  secondary,
  hour,
  avatar,
  playerName,
  spawnKind,
  spawnKey,
  action,
  onZoneChange,
  crowd,
  selfBubble,
  onSelectPerson,
}: Props) {
  const targetRef = useRef<{ x: number; z: number } | null>(null);
  const [activeZone, setActiveZone] = useState<string | null>(null);

  const placed: Placed[] = useMemo(
    () =>
      locations.map((l) => {
        const { x, z } = toWorld(l.map_x, l.map_y);
        return { ...l, x, z, entrance: entranceOf(l.kind, x, z) };
      }),
    [locations]
  );

  const obstacles = useMemo(
    () => placed.map((p) => obstacleOf(p.kind, p.x, p.z)).filter((b): b is Box => b !== null),
    [placed]
  );

  const hub = placed.find((p) => p.kind === "faculty") ?? placed[0];
  const paths = useMemo(
    () =>
      hub
        ? placed.filter((p) => p.id !== hub.id).map((p) => ({ from: hub.entrance, to: p.entrance }))
        : [],
    [placed, hub]
  );

  const lamps = useMemo(() => {
    const out: { x: number; z: number }[] = [];
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
      if (paths.some((path) => distanceToSegment(x, z, path.from, path.to) < 4)) continue;
      out.push({ x, z, s: 0.8 + rand() * 0.6 });
    }
    return out;
  }, [placed, paths]);

  const zones = useMemo(
    () => placed.map((p) => ({ kind: p.kind, x: p.entrance.x, z: p.entrance.z })),
    [placed]
  );

  // Other players gather in a half circle in front of the building they are at.
  const shown: ShownPerson[] = useMemo(() => {
    const counts = new Map<string, number>();
    const out: ShownPerson[] = [];
    for (const m of crowd) {
      const place = placed.find((p) => p.kind === m.kind);
      if (!place) continue;
      const i = counts.get(m.kind) ?? 0;
      counts.set(m.kind, i + 1);
      const a = -1.3 + (i % 7) * 0.43;
      const r = ZONE_RADIUS + 1.6 + Math.floor(i / 7) * 1.4;
      const x = place.entrance.x + Math.sin(a) * r;
      const z = place.entrance.z + Math.cos(a) * r * 0.8;
      out.push({ ...m, x, y: 0, z, heading: Math.atan2(place.entrance.x - x, place.entrance.z - z) });
    }
    return out;
  }, [crowd, placed]);

  const spawnPlace = placed.find((p) => p.kind === spawnKind) ?? placed[0];
  const spawn = spawnPlace ? spawnPlace.entrance : { x: 0, z: 0 };

  const light = lightingFor(hour);
  const night = light.lamp;

  function zoneChanged(kind: string | null) {
    setActiveZone(kind);
    onZoneChange(kind);
  }

  function walkToBuilding(p: Placed) {
    targetRef.current = { ...p.entrance };
  }

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ fov: 45, near: 0.5, far: 260, position: [spawn.x, 11, spawn.z + 13] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <SkyAndFog color={light.sky} />
      <hemisphereLight args={[light.sky, "#3d5a2a", light.ambient * 0.9]} />
      <ambientLight intensity={light.ambient * 0.5} />

      <Ground onPoint={(x, z) => (targetRef.current = { x, z })} />
      {paths.map((p, i) => (
        <Path key={i} from={p.from} to={p.to} />
      ))}
      <Trees spots={trees} />
      <Lamps spots={lamps} night={night} />

      {placed.map((p) => (
        <group key={p.id}>
          <Building
            kind={p.kind}
            name={p.name}
            x={p.x}
            z={p.z}
            primary={primary}
            secondary={secondary}
            night={night}
            billboard={p.has_billboard}
            onSelect={() => walkToBuilding(p)}
          />
          <Zone x={p.entrance.x} z={p.entrance.z} active={activeZone === p.kind} />
        </group>
      ))}

      {shown.map((p) => (
        <OtherPlayer key={p.id} p={p} onSelect={onSelectPerson} />
      ))}

      <Player
        avatar={avatar}
        name={playerName}
        spawn={spawn}
        spawnKey={spawnKey}
        obstacles={obstacles}
        zones={zones}
        locked={action !== null}
        action={action}
        targetRef={targetRef}
        sunColor={light.sunColor}
        sunIntensity={light.sun * 1.6}
        bubble={selfBubble}
        onZoneChange={zoneChanged}
      />
    </Canvas>
  );
}
