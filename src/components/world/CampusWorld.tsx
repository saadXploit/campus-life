"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Object3D, type DirectionalLight, type Group, type Mesh } from "three";
import Avatar3D, { type AvatarAction } from "@/components/scene/Avatar3D";
import { lightingFor } from "@/lib/game/lighting";
import type { GameAd } from "@/lib/game/gameTypes";
import { PLAYER_RADIUS, ZONE_RADIUS, resolveCollision, type Box } from "@/lib/game/worldLayout";
import type { Appearance } from "@/lib/game/shop";
import type { StaffMember } from "@/lib/game/staff";
import type { PlayerCar } from "./Roads";
import { Bubble, NameTag, OtherPlayer, StaffNpc, appearanceProps, type PlacedStaff, type ShownPerson } from "./People";
import { CampusBase, useCampusLayout, type Placed, type WorldLocation } from "./Scenery";

export type { WorldLocation };

export type WorldAvatar = { skin: number; hairStyle: number; hairColor: number; outfit: number };

/** Another player out on campus, shown near the building they are checked in at. */
export type CrowdMember = Omit<ShownPerson, "x" | "y" | "z" | "heading"> & { kind: string };

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
  ads: GameAd[];
  adRotation: number;
  onSelectAd: (ad: GameAd) => void;
  faculties: string[];
  myFaculty: string | null;
  /** Staff on duty outdoors right now (security, cleaners, bosses). */
  staff: StaffMember[];
  staffBubbles: Record<string, string>;
  onSelectStaff: (id: string) => void;
  /** What you bought and wear. */
  appearance?: Appearance;
  /** Your car and the cars of people you can see, parked by the main gate. */
  playerCars?: PlayerCar[];
  /** Your position while you walk (for the mini-map). */
  onPlayerMove?: (x: number, z: number) => void;
};

/** Spots beside each door for staff: right, left, far right, far left. */
const STAFF_SLOTS = [4.4, -4.4, 6.4, -6.4];

const WALK_SPEED = 7;
const RUN_SPEED = 11;
const CAMERA_OFFSET = { y: 11, z: 13 };

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
  stage,
  appearance,
  onMove,
}: {
  /** Called about twice a second with your position while you walk (for the mini-map). */
  onMove?: (x: number, z: number) => void;
  appearance?: Appearance;
  /** While playing sport: the spot on the pitch to run to (and around, for football). */
  stage: { x: number; z: number } | null;
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
  const lastReport = useRef({ t: -1, x: Infinity, z: Infinity });
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

  useFrame(({ camera, clock }, rawDelta) => {
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
      if (stage) {
        // Playing on the pitch: jog there, then (for football) keep running around with the ball.
        const t = clock.elapsedTime;
        const goal =
          action === "football"
            ? { x: stage.x + Math.sin(t * 0.8) * 3, z: stage.z + Math.cos(t * 0.8) * 1.8 }
            : stage;
        const tx = goal.x - p.x;
        const tz = goal.z - p.z;
        const d = Math.hypot(tx, tz);
        if (d > 0.25) {
          dx = tx / d;
          dz = tz / d;
        }
      }
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
    // Tell the mini-map where you are, at most twice a second and only after moving.
    const last = lastReport.current;
    if (onMove && clock.elapsedTime - last.t > 0.5 && Math.hypot(p.x - last.x, p.z - last.z) > 0.3) {
      lastReport.current = { t: clock.elapsedTime, x: p.x, z: p.z };
      onMove(p.x, p.z);
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
          action={action === "exercise" && moving ? "walk" : (action ?? (moving ? "walk" : "idle"))}
          {...appearanceProps(appearance)}
        />
        <NameTag name={name} shine={appearance?.tag} />
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
  ads,
  adRotation,
  onSelectAd,
  faculties,
  myFaculty,
  staff,
  staffBubbles,
  onSelectStaff,
  appearance,
  playerCars = [],
  onPlayerMove,
}: Props) {
  const targetRef = useRef<{ x: number; z: number } | null>(null);
  const [activeZone, setActiveZone] = useState<string | null>(null);

  const layout = useCampusLayout(locations, faculties);
  const { placed, obstacles } = layout;

  const zones = useMemo(
    () => placed.map((p) => ({ kind: p.kind, x: p.entrance.x, z: p.entrance.z })),
    [placed]
  );

  // Other players gather in a half circle in front of the building they are at.
  const shown: ShownPerson[] = useMemo(() => {
    const counts = new Map<string, number>();
    const out: ShownPerson[] = [];
    let onPitch = 0;
    for (const m of crowd) {
      const place = placed.find((p) => p.kind === m.kind);
      if (!place) continue;
      if (m.kind === "sports" && (m.pose === "football" || m.pose === "exercise")) {
        const i = onPitch++;
        const x = place.x + 2 + (i % 5) * 2.6 - 5;
        const z = place.z - 3 + Math.floor(i / 5) * 2.4;
        out.push({ ...m, x, y: 0, z, heading: (i % 2 ? 1 : -1) * Math.PI * 0.5 });
        continue;
      }
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

  // Staff stand beside the door, between the building and where players gather.
  const placedStaff: PlacedStaff[] = useMemo(() => {
    const out: PlacedStaff[] = [];
    for (const m of staff) {
      if (m.indoors) continue;
      const place = placed.find((p) => p.kind === m.kind);
      if (!place) continue;
      out.push({
        staff: m,
        x: place.entrance.x + (m.patrol ? 0 : STAFF_SLOTS[m.slot % STAFF_SLOTS.length]),
        y: 0,
        z: place.entrance.z - 2.1,
        heading: 0,
        pose: "idle",
      });
    }
    return out;
  }, [staff, placed]);

  // Sport is played on the pitch, not at its entrance.
  const field = placed.find((p) => p.kind === "sports") ?? null;
  const sporting = action === "football" || action === "exercise";
  const stage = field && sporting && spawnKind === "sports" ? { x: field.x - 4, z: field.z + 1 } : null;

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

      <CampusBase
        layout={layout}
        primary={primary}
        secondary={secondary}
        night={night}
        ads={ads}
        adRotation={adRotation}
        onGround={(x, z) => (targetRef.current = { x, z })}
        onSelectBuilding={walkToBuilding}
        onSelectAd={onSelectAd}
        myFaculty={myFaculty}
        playerCars={playerCars}
      />
      {placed.map((p) => (
        <Zone key={p.id} x={p.entrance.x} z={p.entrance.z} active={activeZone === p.kind} />
      ))}

      {shown.map((p) => (
        <OtherPlayer key={p.id} p={p} onSelect={onSelectPerson} />
      ))}
      {placedStaff.map((p) => (
        <StaffNpc key={p.staff.id} p={p} bubble={staffBubbles[p.staff.id] ?? null} onSelect={onSelectStaff} />
      ))}

      <Player
        avatar={avatar}
        name={playerName}
        spawn={spawn}
        spawnKey={spawnKey}
        stage={stage}
        appearance={appearance}
        onMove={onPlayerMove}
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
