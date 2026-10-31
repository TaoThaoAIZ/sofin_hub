import { themedSrc } from './ThemedImg';

/**
 * Logo SofinHub theo giao diện: bản sáng chữ "Sofin" đen; bản tối chữ trắng (ảnh nền trong suốt cắt theo khung 155:41 đúng như Figma).
 * `className` đặt chiều cao (vd. `h-10`); chiều rộng tự theo tỉ lệ. Dùng cho mọi chỗ cần logo (không dùng /images/logo.png trực tiếp vì chữ đen mất trên nền tối).
 */
export function BrandLogo({ className = 'h-10', alt = 'SofinHub' }: { className?: string; alt?: string }) {
  return (
    <>
      <img src={themedSrc('light', 'logo')} alt={alt} className={`${className} block w-auto object-contain dark:hidden`} />
      <span className={`${className} relative hidden aspect-[155/41] overflow-hidden dark:block`}>
        <img src={themedSrc('dark', 'logo')} alt={alt} className="absolute top-[-19.44%] left-[-5.88%] h-[138.89%] w-[110.29%] max-w-none" />
      </span>
    </>
  );
}
