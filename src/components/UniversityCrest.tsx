type Props = {
  shortName: string;
  primary: string;
  secondary: string;
  className?: string;
};

export default function UniversityCrest({ shortName, primary, secondary, className }: Props) {
  const text = shortName.slice(0, 4).toUpperCase();
  return (
    <svg viewBox="0 0 100 112" className={className} role="img" aria-label={`${shortName} crest`}>
      <path
        d="M50 4 L92 18 V54 Q92 88 50 108 Q8 88 8 54 V18 Z"
        fill={primary}
        stroke={secondary}
        strokeWidth="4"
      />
      <path
        d="M50 14 L82 25 V54 Q82 80 50 97 Q18 80 18 54 V25 Z"
        fill="none"
        stroke={secondary}
        strokeWidth="1.5"
        opacity="0.6"
      />
      <text
        x="50"
        y="62"
        textAnchor="middle"
        fontSize={text.length > 3 ? 20 : 24}
        fontWeight="800"
        fill={secondary}
        fontFamily="system-ui, sans-serif"
      >
        {text}
      </text>
    </svg>
  );
}