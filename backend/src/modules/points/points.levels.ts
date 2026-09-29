/** Cấp độ thành viên theo tổng điểm (xem BRD mục 5). Ngưỡng là giá trị tạm, chỉnh được ở đây. */
export interface LevelDef {
  level: number;
  name: string;
  minPoints: number;
}

const NAMED = ['Tân Binh', 'Creator', 'YouTuber', 'Pro Creator', 'Master', 'Legend'];
const THRESHOLDS = [0, 20, 60, 120, 200, 300, 450, 650, 900];

export const LEVELS: LevelDef[] = THRESHOLDS.map((minPoints, i) => ({
  level: i + 1,
  name: NAMED[i] ?? '',
  minPoints,
}));

export function levelFor(points: number): LevelDef {
  let cur = LEVELS[0]!;
  for (const l of LEVELS) if (points >= l.minPoints) cur = l;
  return cur;
}
