import { Link, type LinkProps } from 'react-router-dom';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'brand' | 'brand-chip' | 'success';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  brand: 'bg-brand-gradient shadow-brand',
  'brand-chip': 'bg-brand-gradient shadow-brand-chip',
  success: 'bg-[#16a34a] shadow-[0_4px_12px_rgba(22,163,74,.22)]',
};

/**
 * Chỉ chứa phần "nhận diện" dùng chung của nút thương hiệu (nền, bóng, hover, trạng thái
 * disabled, chữ trắng) — KHÔNG áp cỡ/khoảng cách/bo góc, vì các nơi dùng có kích thước khác
 * nhau; truyền qua `className` (vd. `h-10 rounded-[14px] px-[18px] text-sm font-semibold gap-2`).
 */
const BASE =
  'inline-flex items-center justify-center text-white hover:brightness-[1.06] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100';

interface ButtonOwnProps {
  variant?: ButtonVariant;
  children?: ReactNode;
}

export function Button({
  variant = 'brand',
  className = '',
  type = 'button',
  ...props
}: ButtonOwnProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={`${BASE} ${VARIANT_CLASS[variant]} ${className}`} {...props} />;
}

export function ButtonLink({ variant = 'brand', className = '', ...props }: ButtonOwnProps & LinkProps) {
  return <Link className={`${BASE} ${VARIANT_CLASS[variant]} ${className}`} {...props} />;
}
