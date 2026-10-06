import { HAIR_COLORS, OUTFIT_COLORS, SKIN_TONES } from "@/lib/game/options";

type Props = {
  skin: number;
  hairStyle: number;
  hairColor: number;
  outfit: number;
  className?: string;
};

export default function Avatar({ skin, hairStyle, hairColor, outfit, className }: Props) {
  const s = SKIN_TONES[skin] ?? SKIN_TONES[0];
  const h = HAIR_COLORS[hairColor] ?? HAIR_COLORS[0];
  const o = OUTFIT_COLORS[outfit] ?? OUTFIT_COLORS[0];

  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Student avatar">
      {/* hair behind the head */}
      {hairStyle === 1 && <circle cx="100" cy="78" r="54" fill={h} />}
      {hairStyle === 4 && (
        <path d="M58 80 Q58 40 100 40 Q142 40 142 80 L146 150 Q100 165 54 150 Z" fill={h} />
      )}
      {hairStyle === 2 && (
        <g fill={h}>
          <rect x="56" y="70" width="12" height="70" rx="6" />
          <rect x="72" y="74" width="10" height="64" rx="5" />
          <rect x="118" y="74" width="10" height="64" rx="5" />
          <rect x="132" y="70" width="12" height="70" rx="6" />
        </g>
      )}

      {/* body and neck */}
      <path d="M24 200 Q24 148 100 144 Q176 148 176 200 Z" fill={o} />
      <rect x="86" y="118" width="28" height="30" rx="10" fill={s} />
      <path d="M84 146 L100 168 L116 146 Z" fill={s} />

      {/* head and face */}
      <ellipse cx="100" cy="92" rx="38" ry="44" fill={s} />
      <circle cx="62" cy="96" r="7" fill={s} />
      <circle cx="138" cy="96" r="7" fill={s} />
      <circle cx="86" cy="94" r="4" fill="#1b1b1b" />
      <circle cx="114" cy="94" r="4" fill="#1b1b1b" />
      <path
        d="M86 112 Q100 124 114 112"
        stroke="#1b1b1b"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* front hair */}
      {hairStyle === 0 && (
        <path d="M62 86 Q60 46 100 46 Q140 46 138 86 Q124 64 100 64 Q76 64 62 86 Z" fill={h} />
      )}
      {hairStyle === 1 && (
        <path d="M60 84 Q62 52 100 50 Q138 52 140 84 Q122 62 100 62 Q78 62 60 84 Z" fill={h} />
      )}
      {hairStyle === 2 && (
        <path d="M60 86 Q62 46 100 46 Q138 46 140 86 Q122 62 100 62 Q78 62 60 86 Z" fill={h} />
      )}
      {hairStyle === 3 && (
        <g fill={h}>
          <path d="M62 86 Q62 52 100 52 Q138 52 138 86 Q122 66 100 66 Q78 66 62 86 Z" />
          <circle cx="76" cy="46" r="15" />
          <circle cx="100" cy="40" r="16" />
          <circle cx="124" cy="46" r="15" />
        </g>
      )}
      {hairStyle === 4 && (
        <path d="M60 88 Q60 44 100 44 Q140 44 140 88 Q118 62 100 66 Q82 62 60 88 Z" fill={h} />
      )}
      {hairStyle === 5 && (
        <path d="M64 80 Q66 54 100 52 Q134 54 136 80 Q120 68 100 68 Q80 68 64 80 Z" fill={h} />
      )}
    </svg>
  );
}