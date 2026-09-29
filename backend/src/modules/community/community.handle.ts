/** Handle hiển thị của thành viên: slug tên + số ổn định theo id. Không lưu DB — tính khi đọc. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const slug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const handleFor = (name: string, id: string) => `${slug(name)}-${1000 + (hash(id) % 9000)}`;
