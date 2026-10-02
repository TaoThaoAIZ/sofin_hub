/** 2400 -> "2.4K", 950 -> "950" */
export function formatCompact(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

/** Định dạng tiền theo đơn vị chính (không phải cent). USD -> "$7", "$7.50"; VND -> "199.000 ₫". */
export function formatMoney(amount: number, currency = 'USD'): string {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat(currency === 'VND' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(amount);
}
