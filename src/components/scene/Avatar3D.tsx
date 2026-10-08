"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { Pose } from "@/lib/game/interiors";
import { HAIR_COLORS, OUTFIT_COLORS, SKIN_TONES } from "@/lib/game/options";

/** What the character's body is doing. Movement and activities pick one. */
export type AvatarAction = Pose;

type Props = {
  skin: number;
  hairStyle: number;
  hairColor: number;
  outfit: number;
  position?: [number, number, number];
  rotationY?: number;
  action?: AvatarAction;
  /** Staff uniforms: override the shirt and trousers, and add a cap. */
  shirtColor?: string;
  trouserColor?: string;
  capColor?: string | null;
  /** Shop items: a flowing robe (agbada), shades, a chain and sneaker colour. */
  robeColor?: string;
  glassesColor?: string;
  chainColor?: string;
  shoeColor?: string;
};

const HIP_Y = 0.78;
const SHOULDER_Y = 1.36;

function Cap({ r, tilt, color }: { r: number; tilt: number; color: string }) {
  return (
    <mesh rotation={[tilt, 0, 0]} castShadow>
      <sphereGeometry args={[r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color={color} roughness={0.9} flatShading />
    </mesh>
  );
}

export default function Avatar3D({
  skin,
  hairStyle,
  hairColor,
  outfit,
  position = [0, 0, 0],
  rotationY = 0,
  action = "idle",
  shirtColor,
  trouserColor = "#1f2937",
  capColor = null,
  robeColor,
  glassesColor,
  chainColor,
  shoeColor = "#f5f5f4",
}: Props) {
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const ball = useRef<Group>(null);

  const skinColor = SKIN_TONES[skin] ?? SKIN_TONES[0];
  const hair = HAIR_COLORS[hairColor] ?? HAIR_COLORS[0];
  const eating = action === "eat" || action === "dine";
  const shirt = shirtColor ?? OUTFIT_COLORS[outfit] ?? OUTFIT_COLORS[0];

  useFrame((state, delta) => {
    const b = body.current;
    const h = head.current;
    const aL = armL.current;
    const aR = armR.current;
    const lL = legL.current;
    const lR = legR.current;
    if (!b || !h || !aL || !aR || !lL || !lR) return;

    const t = state.clock.elapsedTime;
    // Targets for each joint; we ease towards them so actions blend smoothly.
    let bodyY = Math.sin(t * 2) * 0.012;
    let bodyTilt = 0;
    let lie = 0;
    let armLX = Math.sin(t * 1.4) * 0.04;
    let armRX = -armLX;
    let armLZ = 0.08;
    let armRZ = -0.08;
    let legLX = 0;
    let legRX = 0;
    let headX = 0;

    switch (action) {
      case "walk": {
        const s = Math.sin(t * 9);
        legLX = s * 0.6;
        legRX = -s * 0.6;
        armLX = -s * 0.5;
        armRX = s * 0.5;
        bodyY = Math.abs(Math.cos(t * 9)) * 0.05;
        bodyTilt = 0.06;
        break;
      }
      case "busy": {
        // Hands in front, working (eating, reading, chatting).
        armLX = -1.1 + Math.sin(t * 4) * 0.15;
        armRX = -1.1 + Math.sin(t * 4 + 1.5) * 0.15;
        armLZ = 0.25;
        armRZ = -0.25;
        headX = 0.25 + Math.sin(t * 2) * 0.08;
        break;
      }
      case "talk": {
        // Hands moving while chatting.
        armLX = -0.5 + Math.sin(t * 5) * 0.35;
        armRX = -0.3 + Math.sin(t * 4 + 2) * 0.3;
        armLZ = 0.25;
        armRZ = -0.25;
        headX = Math.sin(t * 3) * 0.1;
        break;
      }
      case "toast": {
        // Glass raised high.
        armRX = -2.7 + Math.sin(t * 3) * 0.08;
        armRZ = -0.15;
        armLX = -0.4;
        headX = -0.15;
        break;
      }
      case "fight": {
        // Alternating punches, body bouncing.
        const s = Math.sin(t * 12);
        armLX = -1.5 + Math.max(0, s) * -0.2;
        armRX = -1.5 + Math.max(0, -s) * -0.2;
        armLZ = 0.15 + Math.max(0, s) * 0.2;
        armRZ = -0.15 - Math.max(0, -s) * 0.2;
        bodyY = Math.abs(Math.sin(t * 6)) * 0.06;
        bodyTilt = 0.15;
        legLX = 0.25;
        legRX = -0.25;
        break;
      }
      case "sit": {
        // Seated (on a chair at seat height 0.45), hands busy at a table.
        bodyY = -0.33;
        legLX = -1.45;
        legRX = -1.45;
        armLX = -0.9 + Math.sin(t * 3) * 0.12;
        armRX = -0.9 + Math.sin(t * 3 + 1.2) * 0.12;
        headX = 0.25;
        break;
      }
      case "exercise": {
        const s = Math.sin(t * 7);
        bodyY = Math.abs(s) * 0.25;
        armLZ = 0.3 + Math.abs(s) * 2.2;
        armRZ = -armLZ;
        legLX = s * 0.25;
        legRX = -s * 0.25;
        break;
      }
      case "dance": {
        const s = Math.sin(t * 6);
        bodyY = Math.abs(s) * 0.1;
        bodyTilt = Math.sin(t * 3) * 0.12;
        armLX = -2.6 + s * 0.4;
        armRX = -0.4 - s * 0.6;
        armLZ = 0.3;
        armRZ = -0.5;
        headX = Math.sin(t * 6) * 0.15;
        break;
      }
      case "eat": {
        // Standing, food in the left hand, the right hand going to the mouth.
        const bite = Math.max(0, Math.sin(t * 2.4));
        armLX = -1.0;
        armLZ = 0.35;
        armRX = -0.9 - bite * 1.5;
        armRZ = -0.35 - bite * 0.15;
        headX = 0.15 - bite * 0.15;
        break;
      }
      case "dine": {
        // Seated at a table, eating.
        const bite = Math.max(0, Math.sin(t * 2.4));
        bodyY = -0.33;
        legLX = -1.45;
        legRX = -1.45;
        armLX = -0.9;
        armRX = -0.9 - bite * 1.4;
        armRZ = -0.25 - bite * 0.15;
        headX = 0.3 - bite * 0.2;
        break;
      }
      case "football": {
        // Jogging with the ball and kicking it on.
        const s = Math.sin(t * 8);
        legLX = s * 0.7;
        legRX = -s * 0.5 - Math.max(0, Math.sin(t * 4)) * 0.6;
        armLX = -s * 0.6;
        armRX = s * 0.6;
        bodyY = Math.abs(Math.cos(t * 8)) * 0.07;
        bodyTilt = 0.1;
        break;
      }
      case "sleep": {
        lie = -Math.PI / 2;
        bodyY = 0.28 + Math.sin(t * 1.2) * 0.01;
        armLZ = 0.15;
        armRZ = -0.15;
        break;
      }
    }

    const k = 1 - Math.exp(-delta * 10);
    b.position.y += (bodyY - b.position.y) * k;
    b.rotation.x += (lie + bodyTilt - b.rotation.x) * k;
    h.rotation.x += (headX - h.rotation.x) * k;
    aL.rotation.x += (armLX - aL.rotation.x) * k;
    aR.rotation.x += (armRX - aR.rotation.x) * k;
    aL.rotation.z += (armLZ - aL.rotation.z) * k;
    aR.rotation.z += (armRZ - aR.rotation.z) * k;
    lL.rotation.x += (legLX - lL.rotation.x) * k;
    lR.rotation.x += (legRX - lR.rotation.x) * k;
    if (ball.current) {
      // The ball rolls out in front of the feet and back.
      const roll = Math.max(0, Math.sin(t * 4));
      ball.current.position.set(0.12, 0.13 + Math.abs(Math.sin(t * 8)) * 0.05, 0.35 + roll * 0.45);
      ball.current.rotation.x = t * 9;
    }
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {action === "football" && (
        <group ref={ball}>
          <mesh castShadow>
            <icosahedronGeometry args={[0.13, 1]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.5} flatShading />
          </mesh>
        </group>
      )}
      <group ref={body}>
        {/* legs: trousers and shoes, pivoting at the hip */}
        {[
          { x: -0.12, ref: legL },
          { x: 0.12, ref: legR },
        ].map(({ x, ref }) => (
          <group key={x} ref={ref} position={[x, HIP_Y, 0]}>
            <mesh position={[0, -0.36, 0]} castShadow>
              <capsuleGeometry args={[0.095, 0.55, 4, 10]} />
              <meshStandardMaterial color={trouserColor} roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.74, 0.05]} castShadow>
              <boxGeometry args={[0.17, 0.09, 0.3]} />
              <meshStandardMaterial color={shoeColor} roughness={0.6} />
            </mesh>
          </group>
        ))}

        {/* torso */}
        <mesh position={[0, 1.08, 0]} castShadow>
          <capsuleGeometry args={[0.25, 0.38, 4, 12]} />
          <meshStandardMaterial color={shirt} roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.47, 0]}>
          <cylinderGeometry args={[0.07, 0.08, 0.12, 10]} />
          <meshStandardMaterial color={skinColor} roughness={0.7} />
        </mesh>
        {robeColor && (
          <mesh position={[0, 0.88, 0]} castShadow>
            <cylinderGeometry args={[0.34, 0.52, 1.0, 14, 1, true]} />
            <meshStandardMaterial color={robeColor} roughness={0.8} side={2} />
          </mesh>
        )}
        {chainColor && (
          <mesh position={[0, 1.37, 0.06]} rotation={[Math.PI / 2 - 0.35, 0, 0]}>
            <torusGeometry args={[0.16, 0.018, 6, 20]} />
            <meshStandardMaterial color={chainColor} metalness={0.9} roughness={0.25} />
          </mesh>
        )}

        {/* arms: sleeve, forearm and hand, pivoting at the shoulder */}
        {[
          { x: -0.34, ref: armL },
          { x: 0.34, ref: armR },
        ].map(({ x, ref }) => (
          <group key={x} ref={ref} position={[x, SHOULDER_Y, 0]}>
            <mesh position={[0, -0.14, 0]} castShadow>
              <capsuleGeometry args={[0.08, 0.16, 4, 8]} />
              <meshStandardMaterial color={shirt} roughness={0.85} />
            </mesh>
            <mesh position={[0, -0.38, 0]} castShadow>
              <capsuleGeometry args={[0.06, 0.24, 4, 8]} />
              <meshStandardMaterial color={skinColor} roughness={0.7} />
            </mesh>
            <mesh position={[0, -0.58, 0]}>
              <sphereGeometry args={[0.07, 10, 8]} />
              <meshStandardMaterial color={skinColor} roughness={0.7} />
            </mesh>
            {/* eating: a plate of food in the left hand, a spoonful in the right */}
            {eating && x < 0 && (
              <group position={[0, -0.66, 0.06]}>
                <mesh>
                  <cylinderGeometry args={[0.16, 0.13, 0.03, 16]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.4} />
                </mesh>
                <mesh position={[0, 0.03, 0]}>
                  <sphereGeometry args={[0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <meshStandardMaterial color="#ea580c" roughness={0.9} />
                </mesh>
              </group>
            )}
            {eating && x > 0 && (
              <mesh position={[0, -0.66, 0.05]}>
                <sphereGeometry args={[0.045, 8, 6]} />
                <meshStandardMaterial color="#f59e0b" roughness={0.9} />
              </mesh>
            )}
          </group>
        ))}

        {/* head */}
        <group ref={head} position={[0, 1.72, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.22, 18, 14]} />
            <meshStandardMaterial color={skinColor} roughness={0.7} />
          </mesh>
          {[-0.07, 0.07].map((x) => (
            <mesh key={x} position={[x, 0.04, 0.195]}>
              <sphereGeometry args={[0.025, 8, 8]} />
              <meshStandardMaterial color="#111111" />
            </mesh>
          ))}
          <mesh position={[0, -0.07, 0.2]} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.012, 0.06, 2, 6]} />
            <meshStandardMaterial color="#5b2b22" />
          </mesh>
          {[-0.22, 0.22].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color={skinColor} roughness={0.7} />
            </mesh>
          ))}

          {hairStyle === 0 && <Cap r={0.235} tilt={-0.6} color={hair} />}
          {hairStyle === 1 && (
            <mesh position={[0, 0.06, -0.12]} castShadow>
              <sphereGeometry args={[0.3, 14, 10]} />
              <meshStandardMaterial color={hair} roughness={0.95} flatShading />
            </mesh>
          )}
          {hairStyle === 2 && (
            <>
              <Cap r={0.235} tilt={-0.6} color={hair} />
              {[-0.17, -0.09, 0.09, 0.17].map((x) => (
                <mesh key={x} position={[x, -0.2, -0.1]}>
                  <cylinderGeometry args={[0.025, 0.025, 0.5, 6]} />
                  <meshStandardMaterial color={hair} roughness={0.9} />
                </mesh>
              ))}
            </>
          )}
          {hairStyle === 3 && (
            <>
              <Cap r={0.235} tilt={-0.6} color={hair} />
              {[-0.16, 0.16].map((x) => (
                <mesh key={x} position={[x, 0.24, -0.03]}>
                  <sphereGeometry args={[0.1, 10, 8]} />
                  <meshStandardMaterial color={hair} roughness={0.95} flatShading />
                </mesh>
              ))}
            </>
          )}
          {hairStyle === 4 && (
            <>
              <Cap r={0.235} tilt={-0.6} color={hair} />
              <mesh position={[0, -0.2, -0.18]}>
                <boxGeometry args={[0.4, 0.55, 0.1]} />
                <meshStandardMaterial color={hair} roughness={0.9} />
              </mesh>
            </>
          )}
          {hairStyle === 5 && <Cap r={0.228} tilt={-0.95} color={hair} />}
          {glassesColor && (
            <mesh position={[0, 0.04, 0.2]}>
              <boxGeometry args={[0.34, 0.08, 0.04]} />
              <meshStandardMaterial color={glassesColor} roughness={0.2} metalness={0.4} />
            </mesh>
          )}
          {capColor && (
            <group position={[0, 0.12, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.24, 0.25, 0.16, 16]} />
                <meshStandardMaterial color={capColor} roughness={0.8} />
              </mesh>
              <mesh position={[0, -0.06, 0.2]}>
                <boxGeometry args={[0.3, 0.03, 0.18]} />
                <meshStandardMaterial color={capColor} roughness={0.8} />
              </mesh>
            </group>
          )}
        </group>
      </group>
    </group>
  );
}
