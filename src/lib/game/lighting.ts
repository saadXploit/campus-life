export type Lighting = {
  sky: string;
  ambient: number;
  sun: number;
  sunColor: string;
  lamp: boolean;
};

/** Light colour for the player's time of day. It tints the 3D characters to match the scene. */
export function lightingFor(hour: number): Lighting {
  if (hour < 8) return { sky: "#f7b267", ambient: 0.55, sun: 1.1, sunColor: "#ffb36b", lamp: false };
  if (hour < 16) return { sky: "#8ecbff", ambient: 0.8, sun: 1.6, sunColor: "#fff4e0", lamp: false };
  if (hour < 20) return { sky: "#f08a5d", ambient: 0.5, sun: 1.0, sunColor: "#ff9a5a", lamp: true };
  return { sky: "#10162f", ambient: 0.22, sun: 0.15, sunColor: "#6c7bd4", lamp: true };
}