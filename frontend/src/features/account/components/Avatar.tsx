export function Avatar({ url, name, size = 40 }: { url?: string | null; name: string; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (url) {
    return <img src={url} alt={name} style={style} className="flex-none rounded-full object-cover" />;
  }
  return (
    <span style={style} className="bg-brand-gradient grid flex-none place-items-center rounded-full font-bold text-white">
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
