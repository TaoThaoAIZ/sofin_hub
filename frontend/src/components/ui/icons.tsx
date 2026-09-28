import type { ReactNode, SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number };

function Svg({ size = 20, ...props }: IconProps & { children: ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...props} />;
}

/** Icon vẽ từ một path duy nhất (danh mục, thống kê...). */
export function PathIcon({
  d,
  fill = 'none',
  stroke = 'none',
  strokeWidth = 2,
  ...props
}: IconProps & { d: string }) {
  return (
    <Svg fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d={d} />
    </Svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Svg fill="none" stroke="#1c1917" strokeWidth={2} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </Svg>
);

export const GlobeIcon = (p: IconProps) => (
  <Svg fill="none" stroke="#1c1917" strokeWidth={1.8} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
  </Svg>
);

export const GraduationCapIcon = (p: IconProps) => (
  <Svg fill="#f26a1b" {...p}>
    <path d="M12 3 1 9l11 6 9-4.9V17h2V9z" />
    <path d="M5 13.2V17c0 1.7 3.1 3 7 3s7-1.3 7-3v-3.8L12 17z" />
  </Svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Svg fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

export const GridIcon = (p: IconProps) => (
  <Svg fill="none" stroke="currentColor" strokeWidth={2} {...p}>
    <rect x="4" y="4" width="6" height="6" rx="1.5" />
    <rect x="14" y="4" width="6" height="6" rx="1.5" />
    <rect x="4" y="14" width="6" height="6" rx="1.5" />
    <rect x="14" y="14" width="6" height="6" rx="1.5" />
  </Svg>
);

export const ListIcon = (p: IconProps) => (
  <Svg fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" {...p}>
    <path d="M5 6h14M5 12h14M5 18h14" />
  </Svg>
);

export const UserIcon = (p: IconProps) => (
  <Svg fill="#78716c" {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0z" />
  </Svg>
);

export const StarIcon = (p: IconProps) => (
  <Svg fill="#f59e0b" {...p}>
    <path d="m12 2 3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z" />
  </Svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Svg fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const MailIcon = (p: IconProps) => (
  <Svg size={22} fill="none" stroke="#78716c" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </Svg>
);

export const LockIcon = (p: IconProps) => (
  <Svg size={22} fill="none" stroke="#78716c" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4M12 15v2" />
  </Svg>
);

export const UserGlyphIcon = (p: IconProps) => (
  <Svg size={22} fill="none" stroke="#78716c" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
);

/** Icon mắt mở/gạch chéo cho nút hiện-ẩn mật khẩu. */
export const EyeIcon = ({ open, ...p }: IconProps & { open: boolean }) => (
  <Svg size={22} fill="none" stroke="#78716c" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path
      d={
        open
          ? 'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10 10 0 0 1 12 5c5 0 9 4 10 7a11 11 0 0 1-2.6 3.8M6.6 6.6A11 11 0 0 0 2 12c1 3 5 7 10 7a10 10 0 0 0 5.4-1.6'
          : 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
      }
    />
  </Svg>
);
