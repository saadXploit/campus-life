/**
 * Background sound for each place, made live with the Web Audio API.
 * Nothing is downloaded, which keeps the game light on mobile data.
 * startAmbient() returns a stop function.
 */

export type AmbientKind =
  | "clubhouse"
  | "cafeteria"
  | "market"
  | "sports"
  | "library"
  | "hostel"
  | "faculty"
  | "health"
  | "outdoor";

type Stop = () => void;

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx);
  if (cached) return cached;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx, buffer);
  return buffer;
}

/** A steady filtered noise bed (crowd, wind, fan, air-conditioning). */
function noiseBed(
  ctx: AudioContext,
  out: AudioNode,
  type: BiquadFilterType,
  freq: number,
  q: number,
  level: number,
  wobbleHz = 0,
  wobbleDepth = 0
): Stop {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.value = level;
  src.connect(filter).connect(gain).connect(out);

  let lfo: OscillatorNode | null = null;
  if (wobbleHz > 0) {
    lfo = ctx.createOscillator();
    lfo.frequency.value = wobbleHz;
    const depth = ctx.createGain();
    depth.gain.value = level * wobbleDepth;
    lfo.connect(depth).connect(gain.gain);
    lfo.start();
  }
  src.start();
  return () => {
    src.stop();
    lfo?.stop();
    gain.disconnect();
  };
}

/** Many people talking: two bands of noise that swell and fade. */
function crowd(ctx: AudioContext, out: AudioNode, level: number): Stop {
  const a = noiseBed(ctx, out, "bandpass", 500, 0.8, level, 0.35, 0.5);
  const b = noiseBed(ctx, out, "bandpass", 1100, 1.2, level * 0.6, 0.53, 0.6);
  return () => {
    a();
    b();
  };
}

function burst(
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  type: BiquadFilterType,
  freq: number,
  length: number,
  level: number
) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  src.connect(filter).connect(gain).connect(out);
  src.start(at, Math.random() * 1.5);
  src.stop(at + length + 0.05);
}

function tone(
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  freq: number,
  length: number,
  level: number,
  type: OscillatorType = "sine",
  endFreq?: number
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, at + length);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

/** Calls fn at random moments between min and max seconds apart. */
function every(min: number, max: number, fn: () => void): Stop {
  let timer: ReturnType<typeof setTimeout>;
  const next = () => {
    timer = setTimeout(() => {
      fn();
      next();
    }, (min + Math.random() * (max - min)) * 1000);
  };
  next();
  return () => clearTimeout(timer);
}

/** A four-on-the-floor club beat with a bassline, scheduled slightly ahead for steady timing. */
function clubBeat(ctx: AudioContext, out: AudioNode): Stop {
  const bpm = 122;
  const step = 60 / bpm / 4;
  const bassNotes = [55, 55, 65.4, 49];
  const bassSteps = new Set([0, 3, 6, 8, 11, 14]);
  let next = ctx.currentTime + 0.1;
  let n = 0;

  const music = ctx.createGain();
  music.gain.value = 0.9;
  music.connect(out);

  const timer = setInterval(() => {
    while (next < ctx.currentTime + 0.15) {
      const s = n % 16;
      const bar = Math.floor(n / 16) % bassNotes.length;
      if (s % 4 === 0) tone(ctx, music, next, 150, 0.28, 0.9, "sine", 45);
      if (s % 4 === 2) burst(ctx, music, next, "highpass", 7000, 0.05, 0.25);
      if (s === 4 || s === 12) burst(ctx, music, next, "bandpass", 1500, 0.14, 0.35);
      if (bassSteps.has(s)) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = bassNotes[bar];
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 380;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.28, next);
        gain.gain.exponentialRampToValueAtTime(0.0001, next + step * 1.8);
        osc.connect(filter).connect(gain).connect(music);
        osc.start(next);
        osc.stop(next + step * 2);
      }
      next += step;
      n++;
    }
  }, 25);

  return () => {
    clearInterval(timer);
    music.disconnect();
  };
}

export function startAmbient(ctx: AudioContext, out: AudioNode, kind: AmbientKind, night: boolean): Stop {
  const stops: Stop[] = [];
  const now = () => ctx.currentTime;

  switch (kind) {
    case "clubhouse":
      stops.push(clubBeat(ctx, out), crowd(ctx, out, 0.08));
      break;
    case "cafeteria":
      stops.push(
        crowd(ctx, out, 0.13),
        noiseBed(ctx, out, "highpass", 5000, 0.7, 0.012),
        every(0.6, 2.4, () => tone(ctx, out, now(), 2500 + Math.random() * 1800, 0.25, 0.05))
      );
      break;
    case "market":
      stops.push(
        crowd(ctx, out, 0.2),
        every(7, 15, () => {
          tone(ctx, out, now(), 420, 0.35, 0.04, "square");
          tone(ctx, out, now() + 0.4, 520, 0.4, 0.04, "square");
        })
      );
      break;
    case "sports":
      stops.push(
        crowd(ctx, out, 0.09),
        noiseBed(ctx, out, "lowpass", 500, 0.5, 0.05, 0.1, 0.5),
        every(9, 18, () => tone(ctx, out, now(), 2800, 0.6, 0.06, "sine", 2900)),
        every(12, 22, () => burst(ctx, out, now(), "bandpass", 900, 2.2, 0.25))
      );
      break;
    case "library":
      stops.push(
        noiseBed(ctx, out, "lowpass", 220, 0.5, 0.05),
        every(8, 20, () => burst(ctx, out, now(), "bandpass", 3000, 0.08, 0.05))
      );
      break;
    case "hostel":
      stops.push(
        noiseBed(ctx, out, "lowpass", 320, 0.7, 0.12, 5.5, 0.35),
        every(15, 35, () => burst(ctx, out, now(), "bandpass", 700, 0.6, 0.04))
      );
      break;
    case "faculty":
      stops.push(crowd(ctx, out, 0.05), noiseBed(ctx, out, "lowpass", 250, 0.5, 0.03));
      break;
    case "health":
      stops.push(
        noiseBed(ctx, out, "lowpass", 260, 0.5, 0.04),
        every(1.4, 1.6, () => tone(ctx, out, now(), 1000, 0.12, 0.05))
      );
      break;
    case "outdoor":
      stops.push(noiseBed(ctx, out, "lowpass", 450, 0.5, night ? 0.03 : 0.06, 0.08, 0.6));
      if (night) {
        // Crickets.
        stops.push(
          every(0.3, 0.9, () => {
            for (let i = 0; i < 3; i++) tone(ctx, out, now() + i * 0.05, 4600, 0.035, 0.03);
          })
        );
      } else {
        // Birds.
        stops.push(
          every(0.8, 3.5, () => {
            const base = 2600 + Math.random() * 1400;
            tone(ctx, out, now(), base, 0.09, 0.04, "sine", base * 1.4);
            tone(ctx, out, now() + 0.12, base * 1.1, 0.07, 0.03, "sine", base * 1.5);
          })
        );
      }
      break;
  }

  return () => stops.forEach((s) => s());
}
