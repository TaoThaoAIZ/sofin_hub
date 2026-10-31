import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import type { CommunityEvent } from './events.types.js';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface DocxEventInput {
  event: CommunityEvent;
  hostName?: string;
}

function fmtTime(e: CommunityEvent): string {
  const d = new Date(e.startAt);
  try {
    return `${new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full', timeStyle: 'short', timeZone: e.timezone }).format(d)} (${e.timezone})`;
  } catch {
    return `${d.toISOString()} (UTC)`; // timezone lưu trong DB không hợp lệ: vẫn xuất được
  }
}

const cell = (text: string, bold = false, width?: number) =>
  new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: text.split('\n').map((line) => new Paragraph({ children: [new TextRun({ text: line, bold })] })),
  });

/** File Word (.docx) liệt kê sự kiện — mở được bằng Word/Google Docs/LibreOffice, thay cho .ics khi người dùng không có ứng dụng lịch. */
export async function buildEventsDocx(items: DocxEventInput[], title: string): Promise<Buffer> {
  const sorted = [...items].sort((a, b) => a.event.startAt.localeCompare(b.event.startAt));
  const children: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun({ text: title, bold: true })] }),
    new Paragraph({ children: [new TextRun({ text: `Xuất ngày ${new Date().toLocaleDateString('vi-VN')} · ${sorted.length} sự kiện`, italics: true })] }),
    new Paragraph({ text: '' }),
  ];
  if (!sorted.length) children.push(new Paragraph({ text: 'Chưa có sự kiện nào.' }));
  for (const { event: e, hostName } of sorted) {
    const rows: [string, string][] = [['Thời gian', fmtTime(e)]];
    if (hostName) rows.push(['Người tổ chức', hostName]);
    if (e.meetingLink) rows.push(['Liên kết tham gia', e.meetingLink]);
    if (e.capacity) rows.push(['Số chỗ tối đa', String(e.capacity)]);
    if (e.cancelledAt) rows.push(['Trạng thái', 'Đã hủy']);
    if (e.description) rows.push(['Mô tả', e.description]);
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: e.title })] }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: rows.map(([k, v]) => new TableRow({ children: [cell(k, true, 25), cell(v, false, 75)] })) }),
      new Paragraph({ text: '' }),
    );
  }
  return Packer.toBuffer(new Document({ creator: 'SofinHub', title, sections: [{ children }] }));
}
