"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { lightingFor } from "@/lib/game/lighting";
import type { Slot } from "@/lib/game/scenes";
import Avatar3D from "./Avatar3D";

export type SceneAvatar = {
  skin: number;
  hairStyle: number;
  hairColor: number;
  outfit: number;
};

// The camera sees a fixed 9:16 window, so a percentage on the picture maps straight to a spot in 3D.
const FOV = 30;
const DIST = 10;
const VIEW_H = 2 * DIST * Math.tan((FOV * Math.PI) / 360);
const VIEW_W = (VIEW_H * 9) / 16;
const AVATAR_HEIGHT = 1.95;

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function AvatarLayer({
  hour,
  avatar,
  slot,
}: {
  hour: number;
  avatar: SceneAvatar;
  slot: Slot;
}) {
  const [supported] = useState(detectWebGL);
  if (!supported) return null;

  const light = lightingFor(hour);
  const x = (slot.x / 100 - 0.5) * VIEW_W;
  const y = (0.5 - slot.y / 100) * VIEW_H;
  const scale = (slot.height * VIEW_H) / AVATAR_HEIGHT;

  return (
    <Canvas dpr={[1, 1.75]} gl={{ alpha: true }} camera={{ position: [0, 0, DIST], fov: FOV }}>
      <ambientLight intensity={light.ambient + 0.35} />
      <directionalLight position={[2, 4, 6]} intensity={light.sun * 0.7} color={light.sunColor} />
      <group position={[x, y, 0]} scale={scale}>
        <Avatar3D
          skin={avatar.skin}
          hairStyle={avatar.hairStyle}
          hairColor={avatar.hairColor}
          outfit={avatar.outfit}
          rotationY={0.2}
        />
        {/* soft shadow under the feet */}
        <mesh position={[0, 0.02, -0.2]} scale={[1, 0.28, 1]}>
          <circleGeometry args={[0.45, 24]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.35} />
        </mesh>
      </group>
    </Canvas>
  );
}