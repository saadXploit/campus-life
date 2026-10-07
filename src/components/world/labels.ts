import { CanvasTexture, SRGBColorSpace } from "three";

/** Draws text onto a texture, for building signs and name tags. */
export function makeLabelTexture(
  text: string,
  { bg = "rgba(11,16,32,0.85)", fg = "#ffffff", accent = "#fbbf24", width = 512 } = {}
): { texture: CanvasTexture; aspect: number } {
  const height = 128;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = bg;
  const r = 28;
  ctx.beginPath();
  ctx.roundRect(4, 4, width - 8, height - 8, r);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(24, height - 22, width - 48, 6);

  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 56;
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  while (ctx.measureText(text).width > width - 60 && size > 20) {
    size -= 2;
    ctx.font = `800 ${size}px system-ui, sans-serif`;
  }
  ctx.fillText(text, width / 2, height / 2 - 6);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, aspect: width / height };
}
