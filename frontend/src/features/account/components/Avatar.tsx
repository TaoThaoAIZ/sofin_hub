import { resolveApiPath } from '../../../lib/api';

/** Avatar dùng chung: có ảnh thì hiện ảnh, không thì chữ cái đầu. `className`/`text` cho phép đổi nền & chữ của bản fallback. */
export function Avatar({
  url,
  name,
  size = 40,
  className = 'bg-brand-gradient text-white',
  text,
  style,
}: {
  url?: string | null;
  name: string;
  size?: number;
  className?: string;
  text?: string;
  style?: React.CSSProperties;
}) {
  const box = { width: size, height: size, fontSize: Math.round(size * 0.4), ...style };
  if (url) {
    return <img src={resolveApiPath(url)} alt={name} style={box} className="flex-none rounded-full object-cover" />;
  }
  return (
    <span style={box} className={`grid flex-none place-items-center rounded-full font-bold ${className}`}>
      {text ?? (name.trim().charAt(0).toUpperCase() || '?')}
    </span>
  );
}
