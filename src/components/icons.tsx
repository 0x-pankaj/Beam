/**
 * Line-icon set matching the Beam design comp (Beam.dc.html).
 * 24×24 viewBox, 1.8 stroke, currentColor — size via the `size` prop or CSS.
 */
type IconProps = { size?: number; className?: string; style?: React.CSSProperties };

function Svg({
  size = 20,
  className,
  style,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** Beam mark — the lightning bolt (filled). */
export function BeamBolt({ size = 20, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
    >
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" />
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 11l9-8 9 8" />
    <path d="M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10" />
  </Svg>
);

export const ScanIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8V5a1 1 0 011-1h3" />
    <path d="M16 4h3a1 1 0 011 1v3" />
    <path d="M20 16v3a1 1 0 01-1 1h-3" />
    <path d="M8 20H5a1 1 0 01-1-1v-3" />
    <path d="M7 12h10" />
  </Svg>
);

export const ActivityIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12h4l3 8 4-16 3 8h4" />
  </Svg>
);

export const UserIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 21a8 8 0 10-16 0" />
    <circle cx={12} cy={8} r={4} />
  </Svg>
);

export const SendIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 17L17 7" />
    <path d="M8 7h9v9" />
  </Svg>
);

export const RequestIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M17 7L7 17" />
    <path d="M16 17H7V8" />
  </Svg>
);

export const SplitIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx={9} cy={8} r={3.2} />
    <path d="M3 20a6 6 0 0112 0" />
    <circle cx={17} cy={9} r={2.5} />
    <path d="M16 14.5a5 5 0 015 5.5" />
  </Svg>
);

export const StoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9h16l-1 11H5L4 9z" />
    <path d="M9 9V6a3 3 0 016 0v3" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Svg>
);

export const GiftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 12v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8" />
    <rect x={3} y={8} width={18} height={4} rx={1} />
    <path d="M12 8v13" />
    <path d="M12 8S10.5 4 8 4a2 2 0 000 4h4zM12 8s1.5-4 4-4a2 2 0 010 4h-4z" />
  </Svg>
);

export const TipIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.8 5.6a5 5 0 00-7-.2l-1.8 1.7-1.8-1.7a5 5 0 00-7 7l8.8 8.6 8.8-8.6a5 5 0 000-6.8z" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 6L9 17l-5-5" />
  </Svg>
);

export const CopyIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x={9} y={9} width={11} height={11} rx={2.5} />
    <path d="M5 15a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2" />
  </Svg>
);

export const LogoutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </Svg>
);

export const ChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 18l6-6-6-6" />
  </Svg>
);
