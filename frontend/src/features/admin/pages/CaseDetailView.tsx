import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import i18n, { currentLocale } from '../../../i18n';
import { formatDateTime, formatRelative } from '../../../lib/datetime';
import { ContentCard, DecisionPanel, KvCard, RiskCard, Row, TimelineCard } from '../components/Cards';
import { PageHeader } from '../components/PageHeader';
import { useCaseActions } from '../components/caseActions';
import { AdminAvatar, AdminButton, Card, ErrorBlock, LoadingBlock, initials } from '../components/ui';
import { useCaseDetail } from '../queries';
import { CASE_EVENT_LABEL, CASE_RISK, CASE_STATUS, REASON_LABEL, TARGET_LABEL, type CaseDetail } from '../types';

const ageText = (days: number, t: TFunction) => {
  if (days >= 365) {
    const y = (days / 365).toFixed(1).replace(/\.0$/, '');
    return t('caseDetail.age.years', { n: i18n.language === 'en' ? y : y.replace('.', ',') });
  }
  return days >= 30 ? t('caseDetail.age.months', { n: Math.floor(days / 30) }) : t('caseDetail.age.days', { n: days });
};

/** Chi tiết vụ việc: nội dung bị báo cáo, thông tin báo cáo, rủi ro người dùng, báo cáo liên quan/tương tự, lịch sử và bảng quyết định. */
export function CaseDetailView() {
  const { t } = useTranslation('admin-pages1');
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const q = useCaseDetail(id);
  const [note, setNote] = useState('');
  const { open, modalEl, assignToMe, assigning } = useCaseActions();

  if (q.isPending) return <LoadingBlock />;
  if (q.isError) {
    return (
      <>
        <PageHeader title={t('caseDetail.title')} trail={[{ label: t('caseDetail.queue'), to: '/admin/moderation' }]} />
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
    ...(rc.likes != null ? [{ icon: 'favorite', text: t('caseDetail.likes', { count: rc.likes, formatted: fmtN(rc.likes) }) }] : []),
    ...(rc.comments != null ? [{ icon: 'chat', text: t('caseDetail.comments', { count: rc.comments, formatted: fmtN(rc.comments) }) }] : []),
    { icon: 'flag', text: t('caseDetail.reports', { count: c.reportCount }) },
    ...(rc.hidden ? [{ icon: 'visibility_off', text: t('caseDetail.hidden') }] : []),
  ];
  const context = [
    ...(rc.parentPost ? [{ name: t('caseDetail.parentPost'), text: rc.parentPost.excerpt }] : []),
    ...rc.thread.map((th) => ({ name: th.author, text: th.text, highlight: th.reported ?? th.author === author, avatar: <span className="grid size-7 flex-none place-items-center rounded-full bg-[#e0e7ff] text-[11px] font-bold text-[#3730a3]">{initials(th.author)}</span> })),
  ];

  const doneText = c.status === 'resolved' || c.status === 'dismissed' ? t('caseDetail.done') : '';
  const canRemove = decidable && c.targetType !== 'member' && rc.exists;

  return (
    <>
      <PageHeader
        title={t('caseDetail.reportTitle', { code: c.caseCode })}
        subtitle={t('caseDetail.subtitle', { reason: REASON_LABEL[c.reason] ?? c.reason, count: c.reportCount, time: formatRelative(c.createdAt) })}
        trail={[{ label: t('caseDetail.queue'), to: '/admin/moderation' }, { label: c.caseCode }]}
        actions={
          <>
            {decidable && (
              <AdminButton icon="person_check" disabled={assigning} onClick={() => assignToMe(c)}>
                {t('caseDetail.claim')}
              </AdminButton>
            )}
            {decidable && (
              <AdminButton icon="priority_high" onClick={() => open('escalate', c, note)}>
                {t('caseDetail.escalate')}
              </AdminButton>
            )}
            {c.reportedUser && (
              <AdminButton icon="person" onClick={() => navigate(`/admin/users/${c.reportedUser!.id}`)}>
                {t('caseDetail.openAuthor')}
              </AdminButton>
            )}
          </>
        }
      />

      <Row cols="1.25fr 1fr .95fr">
        <ContentCard
          title={t('caseDetail.reportedContent')}
          avatar={<AdminAvatar name={author} size={40} seed={c.reportedUser?.id} />}
          author={author}
          meta={`${TARGET_LABEL[c.targetType]}${rc.createdAt ? ` · ${formatDateTime(rc.createdAt)}` : ''}${c.content.community ? t('caseDetail.inCommunity', { name: c.content.community.name }) : ''}`}
          body={rc.exists ? (rc.body ?? rc.excerpt) : `${rc.excerpt || t('caseDetail.noContent')}\n\n${t('caseDetail.goneNote')}`}
          stats={contentStats}
          context={context}
        >
          {rc.imageUrl && <img src={rc.imageUrl} alt={t('caseDetail.attachmentAlt')} className="mt-3 h-[170px] w-full rounded-xl object-cover" />}
        </ContentCard>
        <KvCard
          title={t('caseDetail.info')}
          items={[
            { k: t('caseDetail.reason'), v: REASON_LABEL[c.reason] ?? c.reason },
            { k: t('caseDetail.reporter'), v: c.reporter?.name ?? '—' },
            { k: t('caseDetail.reportedUser'), v: c.reportedUser?.name ?? '—' },
            { k: t('caseDetail.community'), v: c.content.community?.name ?? '—' },
            { k: t('caseDetail.submittedAt'), v: formatDateTime(c.createdAt) },
            { k: t('caseDetail.assignee'), v: c.assignee?.name ?? t('caseDetail.unassigned') },
            { k: t('caseDetail.risk'), v: CASE_RISK[c.risk].label, badge: CASE_RISK[c.risk].tone },
            { k: t('caseDetail.status'), v: CASE_STATUS[c.status].label, badge: CASE_STATUS[c.status].tone },
            ...(c.detail ? [{ k: t('caseDetail.detail'), v: c.detail }] : []),
          ]}
        />
        {ru ? (
          <RiskCard
            title={t('caseDetail.userRisk')}
            items={[
              { label: t('caseDetail.previousReports'), value: String(ru.previousReports), pct: Math.min(100, ru.previousReports * 9), tone: ru.previousReports > 5 ? 'r' : ru.previousReports > 0 ? 'o' : 'g' },
              { label: t('caseDetail.warnings'), value: String(ru.warnings), pct: Math.min(100, ru.warnings * 20), tone: ru.warnings > 0 ? 'o' : 'g' },
              { label: t('caseDetail.suspensions'), value: String(ru.suspensions), pct: Math.min(100, ru.suspensions * 34), tone: ru.suspensions > 0 ? 'r' : 'g' },
              { label: t('caseDetail.accountAge'), value: ageText(ru.accountAgeDays, t), pct: Math.min(100, (ru.accountAgeDays / 730) * 100), tone: 'g' },
            ]}
            verdict={
              ru.previousReports > 5
                ? { text: t('caseDetail.verdictHigh'), tone: 'r' }
                : ru.previousReports > 0 || ru.warnings > 0
                  ? { text: t('caseDetail.verdictMedium'), tone: 'o' }
                  : { text: t('caseDetail.verdictLow'), tone: 'g' }
            }
          />
        ) : (
          <Card title={t('caseDetail.userRisk')}>
            <div className="text-[13px] text-stone-500">{t('caseDetail.noUserInfo')}</div>
          </Card>
        )}
      </Row>

      <Row cols="1.25fr 1fr .95fr">
        <TimelineCard
          title={t('caseDetail.related')}
          sub={t('caseDetail.relatedSub')}
          empty={t('caseDetail.relatedEmpty')}
          items={c.relatedReports.map((r) => ({ icon: 'flag', who: r.reporter.name, text: `${REASON_LABEL[r.reason] ?? r.reason}${r.detail ? ` — ${r.detail}` : ''}`, time: formatRelative(r.createdAt), tone: 'o' }))}
        />
        <TimelineCard
          title={t('caseDetail.similar')}
          empty={t('caseDetail.similarEmpty')}
          items={c.similarCases.map((s) => ({
            icon: s.status === 'resolved' || s.status === 'dismissed' ? 'check_circle' : 'flag',
            who: s.caseCode,
            text: `${s.reportedUser?.name ?? '—'} · ${REASON_LABEL[s.reason] ?? s.reason} · ${CASE_STATUS[s.status].label}`,
            time: formatRelative(s.createdAt),
            tone: s.status === 'resolved' || s.status === 'dismissed' ? 'g' : 'r',
          }))}
        />
        <DecisionPanel
          title={t('caseDetail.decision')}
          note={note}
          onNote={setNote}
          placeholder={t('caseDetail.notePlaceholder')}
          done={doneText}
          buttons={[
            { label: t('caseDetail.dismiss'), icon: 'check', disabled: !decidable, onClick: () => open('dismiss', c, note) },
            { label: t('caseDetail.warn'), icon: 'warning', disabled: !decidable || !c.reportedUser, onClick: () => open('warn', c) },
            ...(c.targetType !== 'member' ? [{ label: t('caseDetail.remove'), icon: 'delete', kind: 'primary' as const, disabled: !canRemove, onClick: () => open('remove', c) }] : []),
            { label: t('caseDetail.restrict'), icon: 'block', disabled: !decidable || !c.reportedUser, onClick: () => open('restrict', c) },
            { label: t('caseDetail.suspend'), icon: 'pause_circle', kind: 'danger', disabled: !decidable || !c.reportedUser, onClick: () => open('suspend', c, note) },
            { label: t('caseDetail.ban'), icon: 'gavel', kind: 'solidDanger', disabled: !decidable || !c.reportedUser, onClick: () => open('ban', c, note) },
            { label: t('caseDetail.resolve'), icon: 'task_alt', disabled: !decidable, onClick: () => open('resolve', c, note) },
          ]}
        />
      </Row>

      <TimelineCard
        title={t('caseDetail.history')}
        sub={t('caseDetail.historySub')}
        empty={t('caseDetail.historyEmpty')}
        items={c.history.map((h) => ({ icon: 'history', who: h.actor?.name ?? t('caseDetail.system'), text: `${CASE_EVENT_LABEL[h.type] ?? h.type}${h.note ? ` · ${h.note}` : ''}`, time: formatRelative(h.createdAt), tone: 'b' }))}
      />
      {modalEl}
    </>
  );
}

const fmtN = (n: number) => n.toLocaleString(currentLocale());
