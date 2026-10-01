import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDateTime, formatRelative } from '../../../lib/datetime';
import { ContentCard, DecisionPanel, KvCard, RiskCard, Row, TimelineCard } from '../components/Cards';
import { PageHeader } from '../components/PageHeader';
import { useCaseActions } from '../components/caseActions';
import { AdminAvatar, AdminButton, Card, ErrorBlock, LoadingBlock, initials } from '../components/ui';
import { useCaseDetail } from '../queries';
import { CASE_EVENT_LABEL, CASE_RISK, CASE_STATUS, REASON_LABEL, TARGET_LABEL, type CaseDetail } from '../types';

const ageText = (days: number) => (days >= 365 ? `${(days / 365).toFixed(1).replace('.', ',').replace(/,0$/, '')} năm` : days >= 30 ? `${Math.floor(days / 30)} tháng` : `${days} ngày`);

/** Chi tiết vụ việc: nội dung bị báo cáo, thông tin báo cáo, rủi ro người dùng, báo cáo liên quan/tương tự, lịch sử và bảng quyết định. */
export function CaseDetailView() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const q = useCaseDetail(id);
  const [note, setNote] = useState('');
  const { open, modalEl, assignToMe, assigning } = useCaseActions();

  if (q.isPending) return <LoadingBlock />;
  if (q.isError) {
    return (
      <>
        <PageHeader title="Chi tiết báo cáo" trail={[{ label: 'Hàng đợi báo cáo', to: '/admin/moderation' }]} />
        <Card>
          <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
        </Card>
      </>
    );
  }
  const c: CaseDetail = q.data;
  const rc = c.reportedContent;
  const ru = c.reportedUserInfo;
  const decidable = c.status === 'open' || c.status === 'under_review';
  const author = rc.author ?? c.reportedUser?.name ?? '—';

  const contentStats = [
    ...(rc.likes != null ? [{ icon: 'favorite', text: `${fmtN(rc.likes)} lượt thích` }] : []),
    ...(rc.comments != null ? [{ icon: 'chat', text: `${fmtN(rc.comments)} bình luận` }] : []),
    { icon: 'flag', text: `${c.reportCount} báo cáo` },
    ...(rc.hidden ? [{ icon: 'visibility_off', text: 'Đã bị ẩn' }] : []),
  ];
  const context = [
    ...(rc.parentPost ? [{ name: 'Bài gốc', text: rc.parentPost.excerpt }] : []),
    ...rc.thread.map((t) => ({ name: t.author, text: t.text, highlight: t.reported ?? t.author === author, avatar: <span className="grid size-7 flex-none place-items-center rounded-full bg-[#e0e7ff] text-[11px] font-bold text-[#3730a3]">{initials(t.author)}</span> })),
  ];

  const doneText = c.status === 'resolved' || c.status === 'dismissed' ? 'Đã xử lý · quyết định đã lưu vào nhật ký' : '';
  const canRemove = decidable && c.targetType !== 'member' && rc.exists;

  return (
    <>
      <PageHeader
        title={`Báo cáo ${c.caseCode}`}
        subtitle={`${REASON_LABEL[c.reason] ?? c.reason} · bị báo cáo ${c.reportCount} lần · ${formatRelative(c.createdAt)}`}
        trail={[{ label: 'Hàng đợi báo cáo', to: '/admin/moderation' }, { label: c.caseCode }]}
        actions={
          <>
            {decidable && (
              <AdminButton icon="person_check" disabled={assigning} onClick={() => assignToMe(c)}>
                Nhận xử lý
              </AdminButton>
            )}
            {decidable && (
              <AdminButton icon="priority_high" onClick={() => open('escalate', c, note)}>
                Nâng mức rủi ro
              </AdminButton>
            )}
            {c.reportedUser && (
              <AdminButton icon="person" onClick={() => navigate(`/admin/users/${c.reportedUser!.id}`)}>
                Mở hồ sơ tác giả
              </AdminButton>
            )}
          </>
        }
      />

      <Row cols="1.25fr 1fr .95fr">
        <ContentCard
          title="Nội dung bị báo cáo"
          avatar={<AdminAvatar name={author} size={40} seed={c.reportedUser?.id} />}
          author={author}
          meta={`${TARGET_LABEL[c.targetType]}${rc.createdAt ? ` · ${formatDateTime(rc.createdAt)}` : ''}${c.content.community ? ` · trong ${c.content.community.name}` : ''}`}
          body={rc.exists ? (rc.body ?? rc.excerpt) : `${rc.excerpt || '(Không có nội dung)'}\n\n(Nội dung gốc không còn tồn tại — hiển thị ảnh chụp lúc báo cáo.)`}
          stats={contentStats}
          context={context}
        >
          {rc.imageUrl && <img src={rc.imageUrl} alt="Tệp đính kèm của nội dung bị báo cáo" className="mt-3 h-[170px] w-full rounded-xl object-cover" />}
        </ContentCard>
        <KvCard
          title="Thông tin báo cáo"
          items={[
            { k: 'Lý do', v: REASON_LABEL[c.reason] ?? c.reason },
            { k: 'Người báo cáo', v: c.reporter?.name ?? '—' },
            { k: 'Người bị báo cáo', v: c.reportedUser?.name ?? '—' },
            { k: 'Cộng đồng', v: c.content.community?.name ?? '—' },
            { k: 'Gửi lúc', v: formatDateTime(c.createdAt) },
            { k: 'Phụ trách', v: c.assignee?.name ?? 'Chưa phân công' },
            { k: 'Rủi ro', v: CASE_RISK[c.risk].label, badge: CASE_RISK[c.risk].tone },
            { k: 'Trạng thái', v: CASE_STATUS[c.status].label, badge: CASE_STATUS[c.status].tone },
            ...(c.detail ? [{ k: 'Chi tiết', v: c.detail }] : []),
          ]}
        />
        {ru ? (
          <RiskCard
            title="Rủi ro người dùng"
            items={[
              { label: 'Báo cáo trước đây', value: String(ru.previousReports), pct: Math.min(100, ru.previousReports * 9), tone: ru.previousReports > 5 ? 'r' : ru.previousReports > 0 ? 'o' : 'g' },
              { label: 'Cảnh cáo', value: String(ru.warnings), pct: Math.min(100, ru.warnings * 20), tone: ru.warnings > 0 ? 'o' : 'g' },
              { label: 'Lần tạm ngưng', value: String(ru.suspensions), pct: Math.min(100, ru.suspensions * 34), tone: ru.suspensions > 0 ? 'r' : 'g' },
              { label: 'Tuổi tài khoản', value: ageText(ru.accountAgeDays), pct: Math.min(100, (ru.accountAgeDays / 730) * 100), tone: 'g' },
            ]}
            verdict={
              ru.previousReports > 5
                ? { text: 'Rủi ro cao · vi phạm nhiều lần', tone: 'r' }
                : ru.previousReports > 0 || ru.warnings > 0
                  ? { text: 'Rủi ro trung bình', tone: 'o' }
                  : { text: 'Rủi ro thấp', tone: 'g' }
            }
          />
        ) : (
          <Card title="Rủi ro người dùng">
            <div className="text-[13px] text-stone-500">Không có thông tin người dùng (tài khoản có thể đã bị xóa).</div>
          </Card>
        )}
      </Row>

      <Row cols="1.25fr 1fr .95fr">
        <TimelineCard
          title="Báo cáo liên quan"
          sub="Các báo cáo khác về cùng nội dung/đối tượng"
          empty="Không có báo cáo liên quan."
          items={c.relatedReports.map((r) => ({ icon: 'flag', who: r.reporter.name, text: `${REASON_LABEL[r.reason] ?? r.reason}${r.detail ? ` — ${r.detail}` : ''}`, time: formatRelative(r.createdAt), tone: 'o' }))}
        />
        <TimelineCard
          title="Vụ việc tương tự"
          empty="Không có vụ việc tương tự."
          items={c.similarCases.map((s) => ({
            icon: s.status === 'resolved' || s.status === 'dismissed' ? 'check_circle' : 'flag',
            who: s.caseCode,
            text: `${s.reportedUser?.name ?? '—'} · ${REASON_LABEL[s.reason] ?? s.reason} · ${CASE_STATUS[s.status].label}`,
            time: formatRelative(s.createdAt),
            tone: s.status === 'resolved' || s.status === 'dismissed' ? 'g' : 'r',
          }))}
        />
        <DecisionPanel
          title="Quyết định"
          note={note}
          onNote={setNote}
          placeholder="Ghi chú nội bộ (không gửi người dùng)..."
          done={doneText}
          buttons={[
            { label: 'Không vi phạm', icon: 'check', disabled: !decidable, onClick: () => open('dismiss', c, note) },
            { label: 'Cảnh cáo', icon: 'warning', disabled: !decidable || !c.reportedUser, onClick: () => open('warn', c) },
            { label: 'Gỡ nội dung', icon: 'delete', kind: 'primary', disabled: !canRemove, onClick: () => open('remove', c) },
            { label: 'Hạn chế', icon: 'block', disabled: !decidable || !c.reportedUser, onClick: () => open('restrict', c) },
            { label: 'Tạm ngưng', icon: 'pause_circle', kind: 'danger', disabled: !decidable || !c.reportedUser, onClick: () => open('suspend', c, note) },
            { label: 'Cấm', icon: 'gavel', kind: 'solidDanger', disabled: !decidable || !c.reportedUser, onClick: () => open('ban', c, note) },
            { label: 'Đóng vụ việc', icon: 'task_alt', disabled: !decidable, onClick: () => open('resolve', c, note) },
          ]}
        />
      </Row>

      <TimelineCard
        title="Lịch sử vụ việc"
        sub="Mọi thao tác trên vụ việc này"
        empty="Chưa có lịch sử."
        items={c.history.map((h) => ({ icon: 'history', who: h.actor?.name ?? 'Hệ thống', text: `${CASE_EVENT_LABEL[h.type] ?? h.type}${h.note ? ` · ${h.note}` : ''}`, time: formatRelative(h.createdAt), tone: 'b' }))}
      />
      {modalEl}
    </>
  );
}

const fmtN = (n: number) => n.toLocaleString('vi-VN');
