"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import Avatar3D, { type AvatarAction } from "./Avatar3D";

type Props = {
  skin: number;
  hairStyle: number;
  hairColor: number;
  outfit: number;
  action?: AvatarAction;
};

function Turntable(props: Props) {
  const ref = useRef<Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.5;
  });
  return (
    <group ref={ref}>
      <Avatar3D {...props} />
    </group>
  );
}

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** A slowly turning 3D view of the character, for the creator and profile screens. */
export default function AvatarPreview(props: Props) {
  const [supported] = useState(detectWebGL);
  if (!supported) return null;

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 1.3, 3.6], fov: 35 }}
      onCreated={({ camera }) => camera.lookAt(0, 1, 0)}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 4, 3]} intensity={1.6} castShadow />
      <directionalLight position={[-3, 2, -2]} intensity={0.5} color="#fbbf24" />
      <Turntable {...props} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.9, 32]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
    </Canvas>
  );
}
