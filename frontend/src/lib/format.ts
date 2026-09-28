/** 2400 -> "2.4K", 950 -> "950" */
export function formatCompact(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}
