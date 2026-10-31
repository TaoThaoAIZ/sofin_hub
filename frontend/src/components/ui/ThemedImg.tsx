/**
 * Ảnh/icon có 2 phiên bản theo giao diện (bản thiết kế Figma có khung sáng và khung tối riêng — màu icon, ảnh nền, logo khác nhau).
 * File nằm ở public/images/home/{light,dark}/<tên>.<đuôi>; render cả 2 thẻ <img> và để CSS (class `dark` trên <html>) ẩn bản không dùng,
 * nên không chớp khi đổi giao diện và không cần biết giao diện trong JS.
 */
const EXT: Record<string, [light: string, dark: string]> = {
  logo: ['png', 'webp'],
  footer_logo: ['png', 'webp'],
  hero_bg: ['webp', 'webp'],
  cta_img: ['webp', 'webp'],
  guest_art: ['webp', 'webp'],
  soc53: ['png', 'png'],
  soc54: ['png', 'png'],
  soc56: ['png', 'png'],
  soc57: ['png', 'png'],
};

export const themedSrc = (theme: 'light' | 'dark', name: string) =>
  `/images/home/${theme}/${name}.${EXT[name]?.[theme === 'light' ? 0 : 1] ?? 'svg'}`;

export function ThemedImg({
  name,
  className = '',
  style,
  lazy = false,
}: {
  name: string;
  /** Áp cho CẢ HAI thẻ (kích thước, vị trí...). */
  className?: string;
  style?: React.CSSProperties;
  lazy?: boolean;
}) {
  const loading = lazy ? 'lazy' : undefined;
  return (
    <>
      <img src={themedSrc('light', name)} alt="" aria-hidden="true" loading={loading} draggable={false} className={`${className} dark:hidden`} style={style} />
      <img src={themedSrc('dark', name)} alt="" aria-hidden="true" loading={loading} draggable={false} className={`${className} hidden dark:block`} style={style} />
    </>
  );
}
