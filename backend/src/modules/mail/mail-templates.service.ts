import { prisma } from '../../db/prisma.js';
import { cfg } from '../settings/settings.service.js';
import { mailService, type MailMessage } from './mail.service.js';

/**
 * Mẫu email chỉnh sửa được (bảng EmailTemplate). Cú pháp biến `{{ten}}`. Nội dung là văn bản thuần; HTML được dựng
 * bằng cách escape rồi đổi xuống dòng thành <br> (giá trị biến dạng http(s) thành liên kết).
 */
export type Lang = 'en' | 'vi';
export type LangMap = Partial<Record<Lang, string>>;

const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function templateVariables(...texts: string[]): string[] {
  const set = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(VAR_RE)) set.add(m[1]!);
  return [...set];
}

export function renderText(tpl: string, vars: Record<string, string>): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const text = tpl.replace(VAR_RE, (_m, k: string) => {
    if (k in vars) return vars[k]!;
    missing.add(k);
    return `{{${k}}}`;
  });
  return { text, missing: [...missing] };
}

export function renderHtml(tpl: string, vars: Record<string, string>): string {
  const parts = tpl.split(VAR_RE); // [text, varName, text, varName, ...]
  const html = parts
    .map((part, i) => {
      if (i % 2 === 0) return esc(part);
      if (!(part in vars)) return esc(`{{${part}}}`);
      const v = vars[part]!;
      return /^https?:\/\//.test(v) ? `<a href="${esc(v)}">${esc(v)}</a>` : esc(v);
    })
    .join('');
  return `<p>${html.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
}

export function pickLang(map: LangMap, lang: Lang): { lang: Lang; value: string } | null {
  if (map[lang]) return { lang, value: map[lang]! };
  const other: Lang = lang === 'en' ? 'vi' : 'en';
  return map[other] ? { lang: other, value: map[other]! } : null;
}

export function renderTemplate(t: { subject: unknown; body: unknown }, lang: Lang, vars: Record<string, string>) {
  const subject = pickLang(t.subject as LangMap, lang)?.value ?? '';
  const body = pickLang(t.body as LangMap, lang)?.value ?? '';
  const s = renderText(subject, vars);
  const b = renderText(body, vars);
  return { subject: s.text, text: b.text, html: renderHtml(body, vars), missing: [...new Set([...s.missing, ...b.missing])] };
}

export const mailTemplates = {
  /** Gửi email theo mẫu `key` nếu đang `active` (đã sửa/duyệt trong Admin); ngược lại dùng nội dung mặc định `fallback` trong code. */
  async send(key: string, to: string, vars: Record<string, string>, fallback: Omit<MailMessage, 'to'>): Promise<void> {
    let message: MailMessage = { to, ...fallback };
    try {
      const t = await prisma.emailTemplate.findUnique({ where: { key } });
      if (t && t.status === 'active') {
        const r = renderTemplate(t, cfg().platform.defaultLanguage, vars);
        if (r.subject && r.text) message = { to, subject: r.subject, text: r.text, html: r.html };
      }
    } catch {
      // Lỗi đọc mẫu không được chặn việc gửi mail (token đặt lại mật khẩu...) -> dùng bản mặc định.
    }
    await mailService.send(message);
  },
};
