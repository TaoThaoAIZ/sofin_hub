import i18n from '../../i18n';
import type { Segment, SearchResult } from './types';

/** Render mảng {text, match}: đoạn match bọc <mark>. Chỉ dùng text node, KHÔNG innerHTML. */
export function Highlight({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) =>
        s.match ? (
          <mark key={i} className="rounded bg-brand/20 px-0.5 font-semibold text-inherit">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

export const segmentsToText = (segs: Segment[]) => segs.map((s) => s.text).join('');

/** Đích điều hướng của một kết quả (thành viên seed 'seed:' không có trang hồ sơ nên chuyển sang tab Thành viên). */
export function resultHref(r: SearchResult): string {
  switch (r.type) {
    case 'course':
      return `/communities/${r.id}`;
    case 'post':
      return `/communities/${r.courseId}/community?post=${encodeURIComponent(r.id)}`;
    case 'member':
      return r.id.startsWith('seed:')
        ? `/communities/${r.courseId}/community/thanh-vien?q=${encodeURIComponent(r.handle)}`
        : `/users/${encodeURIComponent(r.id)}`;
  }
}

export function resultTitle(r: SearchResult): string {
  if (r.type === 'course') return segmentsToText(r.title);
  if (r.type === 'member') return segmentsToText(r.name);
  return i18n.t('row.postTitle', { ns: 'search', author: r.author });
}

export const RESULT_ICON: Record<SearchResult['type'], string> = { course: 'school', member: 'person', post: 'article' };
