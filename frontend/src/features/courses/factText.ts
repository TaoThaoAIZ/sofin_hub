import i18n from '../../i18n';

/** Backend trả nhãn/giá trị số liệu và ghi chú giá bằng tiếng Việt (nhãn còn được code so khớp); dịch lúc hiển thị. */
const LABELS: Record<string, string> = {
  'Thành viên': 'members',
  'Bài học': 'lessons',
  'Quản trị viên': 'admins',
  'Chi phí tham gia': 'cost',
  'Cộng đồng': 'community',
};
const VALUES: Record<string, string> = { 'Miễn phí': 'free', 'Riêng tư': 'private', 'Công khai': 'public' };

const tr = (key: string, fallback: string, opts?: Record<string, unknown>) => i18n.t(`detail.facts.${key}`, { ns: 'course', defaultValue: fallback, ...opts });

export const factLabel = (label: string) => (LABELS[label] ? tr(`label.${LABELS[label]}`, label) : label);

export const factValue = (value: string) => {
  if (VALUES[value]) return tr(`value.${VALUES[value]}`, value);
  const m = /^(.+)đ\/tháng$/.exec(value);
  return m ? tr('value.perMonth', value, { price: m[1] }) : value;
};

export const priceNote = (note: string) => {
  if (note === 'Hủy bất kỳ lúc nào') return tr('note.cancelAnytime', note);
  const m = /^Miễn phí dùng thử (\d+) ngày$/.exec(note);
  return m ? tr('note.trial', note, { n: Number(m[1]) }) : note;
};
