import { Fragment, type ReactNode } from 'react';

/** Bỏ ký hiệu Markdown để hiện bản xem trước một đoạn văn thuần (thẻ, kết quả tìm kiếm, dòng mô tả ngắn). */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

const INLINE = /(\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = i++;
    if (m[2] ?? m[3]) out.push(<strong key={key}>{inline((m[2] ?? m[3])!)}</strong>);
    else if (m[4]) out.push(<em key={key}>{m[4]}</em>);
    else if (m[5]) out.push(<code key={key} className="rounded bg-black/5 px-1 py-0.5 text-[0.9em]">{m[5]}</code>);
    else out.push(<a key={key} href={m[7]} target="_blank" rel="noreferrer noopener" className="text-brand underline">{m[6]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * Hiển thị Markdown cơ bản (tiêu đề, in đậm/nghiêng, danh sách, liên kết http(s), code) bằng phần tử React — không dùng HTML thô nên an toàn.
 * Cố ý nhỏ gọn: mô tả cộng đồng chỉ cần các cú pháp này.
 */
export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flushPara = () => {
    if (para.length) blocks.push(<p key={blocks.length} className="m-0">{para.map((l, i) => <Fragment key={i}>{i > 0 && <br />}{inline(l)}</Fragment>)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(<Tag key={blocks.length} className={`m-0 pl-5 ${list.ordered ? 'list-decimal' : 'list-disc'}`}>{list.items.map((it, i) => <li key={i}>{inline(it)}</li>)}</Tag>);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line);
    const li = /^\s*([-*+]|\d+\.)\s+(.*)$/.exec(line);
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (h) {
      flushPara();
      flushList();
      blocks.push(<p key={blocks.length} className="m-0 font-bold">{inline(h[2]!)}</p>);
    } else if (li) {
      flushPara();
      const ordered = /\d/.test(li[1]!);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push(li[2]!);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return <div className={`flex flex-col gap-2 break-words ${className}`}>{blocks}</div>;
}
