/** Rút gọn email dài để chèn vào câu/toast: giữ phần @domain, cắt phần tên bằng "…" (vd. tranmylinh849fgre…@gmail.com). */
export function shortEmail(email: string, max = 32): string {
  if (email.length <= max) return email;
  const at = email.lastIndexOf('@');
  const domain = at > 0 ? email.slice(at) : '';
  const keep = max - domain.length - 1;
  return keep < 4 ? `${email.slice(0, max - 1)}…` : `${email.slice(0, keep)}…${domain}`;
}
