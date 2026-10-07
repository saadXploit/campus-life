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

/** An ad poster: big headline, smaller line, and a clear "Sponsored" label. */
export function makeAdTexture(
  headline: string,
  subline: string | null,
  bg: string,
  fg: string,
  advertiser: string | null
): { texture: CanvasTexture; aspect: number } {
  const width = 1024;
  const height = 320;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const fit = (text: string, start: number, max: number) => {
    let size = start;
    ctx.font = `900 ${size}px system-ui, sans-serif`;
    while (ctx.measureText(text).width > max && size > 24) {
      size -= 4;
      ctx.font = `900 ${size}px system-ui, sans-serif`;
    }
  };

  fit(headline.toUpperCase(), 120, width - 80);
  ctx.fillText(headline.toUpperCase(), width / 2, subline ? 120 : 150);
  if (subline) {
    fit(subline, 60, width - 120);
    ctx.globalAlpha = 0.85;
    ctx.fillText(subline, width / 2, 220);
    ctx.globalAlpha = 1;
  }
  if (advertiser) {
    ctx.font = "600 28px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.globalAlpha = 0.75;
    ctx.fillText(`Sponsored · ${advertiser}`, width - 24, height - 26);
    ctx.globalAlpha = 1;
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, aspect: width / height };
}
