import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { Pager } from '../../../components/ui/Pager';
import { communityHome } from '../../../lib/paths';
import { useCommunityDetail } from '../../courses/queries';
import { Avatar } from '../../account/components/Avatar';
import { useDownloadSurveyCsv, useSurveyList, useSurveyOverview, useSurveyResponses, useSurveyTexts } from '../queries';
import type { SurveyOverview } from '../types';
import { errText, ErrorNote, fmtDateTime, ghostBtn, isModPlus, toast, ToastHost } from './contentUi';
import { PageBanner } from './shared';

type Tab = 'overview' | 'texts' | 'people';

function useDebounced(value: string, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function StaffOnly() {
  const { t } = useTranslation('course');
  return (
    <div className="glass mx-auto max-w-lg rounded-3xl p-8 text-center">
      <MaterialIcon name="lock" size={36} filled color="#ff570a" />
      <h1 className="mt-2 mb-1 text-xl font-extrabold">{t('surveyResults.staffOnly')}</h1>
    </div>
  );
}

const cardCls = 'rounded-2xl border border-[rgba(120,60,20,.1)] bg-white p-4';
const searchCls = 'h-10 w-full rounded-xl border-[1.5px] border-[#e7e0da] bg-white px-3 text-[13.5px] outline-0 focus:border-brand';

/** Trang "Khảo sát" của cộng đồng (mod+): danh sách khảo sát từng bài kèm số người trả lời / tỷ lệ trên tổng thành viên. */
export function SurveysPage() {
  const { t } = useTranslation('course');
  const { id: communityId = '' } = useParams();
  const { data: course } = useCommunityDetail(communityId);
  const list = useSurveyList(communityId);
  if (!course) return null;
  if (!isModPlus(course.viewerRole)) return <StaffOnly />;
  const data = list.data;

  return (
    <main className="flex min-w-0 flex-col gap-4">
      <PageBanner image="cal-hero-bg.webp" icon="poll" title={t('surveyResults.pageTitle')} subtitle={t('surveyResults.pageSubtitle')} />
      {list.isPending && <p className="text-sm text-stone-400">{t('survey.loading')}</p>}
      {list.isError && <ErrorNote message={errText(list.error)} />}
      {data && data.surveys.length === 0 && (
        <div className={`${cardCls} text-center text-[14px] text-stone-600`}>
          <MaterialIcon name="poll" size={34} color="#ff570a" />
          <p className="mt-2 mb-0">{t('surveyResults.empty')}</p>
        </div>
      )}
      {data && data.surveys.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {data.surveys.map((s) => {
            const pct = data.memberCount ? Math.min(100, Math.round((s.responseCount / data.memberCount) * 100)) : 0;
            return (
              <li key={s.lessonId}>
                <Link to={communityHome(communityId, `khao-sat/${s.lessonId}`)} className={`${cardCls} block hover:border-brand`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-bold break-words">{s.lessonTitle}</div>
                      <div className="text-[12.5px] text-stone-500">{s.moduleTitle} · {t('surveyResults.questionCount', { count: s.questionCount })}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[18px] font-extrabold text-brand">{s.responseCount}</div>
                      <div className="text-[11.5px] text-stone-500">{t('surveyResults.responses')}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-[12px] text-stone-500">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="flex-none">{t('surveyResults.rate', { pct, total: data.memberCount })}</span>
                  </div>
                  <div className="mt-1.5 text-[11.5px] text-stone-400">
                    {s.lastAnsweredAt ? t('surveyResults.lastAnswered', { time: fmtDateTime(s.lastAnsweredAt) }) : t('surveyResults.noAnswerYet')}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function OverviewTab({ data }: { data: SurveyOverview }) {
  const { t } = useTranslation('course');
  const [sorted, setSorted] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 self-end text-[12.5px]">
        <input type="checkbox" checked={sorted} onChange={(e) => setSorted(e.target.checked)} className="size-4 accent-brand" /> {t('surveyResults.sortByVotes')}
      </label>
      {data.questions.map((q, i) => {
        const options = sorted ? [...q.options].sort((a, b) => b.count - a.count) : q.options;
        const max = Math.max(1, ...q.options.map((o) => o.count));
        return (
          <div key={q.id} className={cardCls}>
            <div className="text-[14px] font-bold">
              {i + 1}. {q.text}
              <span className="ml-2 text-[12px] font-medium text-stone-500">({t('surveyEditor.answeredCount', { n: q.answered, total: data.responseCount })} · {t(`surveyEditor.types.${q.type}`)})</span>
            </div>
            {q.type === 'text' ? (
              <p className="m-0 mt-2 text-[12.5px] text-stone-500">{t('surveyResults.textQuestionHint')}</p>
            ) : (
              <>
              <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                {options.map((o) => {
                  const pct = q.answered ? Math.round((o.count / q.answered) * 100) : 0;
                  return (
                    <li key={o.text} className="text-[13px]">
                      <div className="flex justify-between gap-3">
                        <span className="min-w-0 break-words">{o.text}</span>
                        <span className="flex-none font-semibold">{o.count} · {pct}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-200">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${(o.count / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
              {q.allowText && <p className="m-0 mt-2 text-[12px] text-stone-500">{t('surveyResults.otherHint')}</p>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TextsTab({ communityId, lessonId, data }: { communityId: string; lessonId: string; data: SurveyOverview }) {
  const { t } = useTranslation('course');
  const textQs = data.questions.filter((q) => q.allowText);
  const [qid, setQid] = useState(textQs[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  useEffect(() => setPage(1), [q, qid]);
  const res = useSurveyTexts(communityId, lessonId, { questionId: qid, q: q || undefined, page });

  if (textQs.length === 0) return <p className={`${cardCls} m-0 text-[13.5px] text-stone-500`}>{t('surveyResults.noTextQuestions')}</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <select value={qid} onChange={(e) => setQid(e.target.value)} aria-label={t('surveyResults.pickQuestion')} className="h-10 max-w-full rounded-xl border-[1.5px] border-[#e7e0da] bg-white px-2 text-[13px] outline-0 focus:border-brand">
          {textQs.map((tq) => (
            <option key={tq.id} value={tq.id}>{tq.text}</option>
          ))}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('surveyResults.searchText')} aria-label={t('surveyResults.searchText')} className={`${searchCls} min-w-[200px] flex-1`} />
      </div>
      {res.isError && <ErrorNote message={errText(res.error)} />}
      {res.data && (
        <>
          <p className="m-0 text-[12.5px] text-stone-500">{t('surveyResults.totalFound', { count: res.data.meta.total })}</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {res.data.data.length === 0 && <li className={`${cardCls} text-[13px] text-stone-500`}>{t('surveyEditor.noText')}</li>}
            {res.data.data.map((x, i) => (
              <li key={i} className={cardCls}>
                <div className="flex items-center gap-2">
                  <Avatar url={x.user.avatarUrl} name={x.user.name} size={26} className="bg-brand/10 text-brand" />
                  <span className="text-[13.5px] font-bold">{x.user.name}</span>
                  <span className="ml-auto text-[11.5px] text-stone-400">{fmtDateTime(x.answeredAt)}</span>
                </div>
                <p className="m-0 mt-2 text-[13.5px] break-words whitespace-pre-wrap">{x.text}</p>
              </li>
            ))}
          </ul>
          <Pager page={res.data.meta.page} totalPages={res.data.meta.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

function PeopleTab({ communityId, lessonId, data }: { communityId: string; lessonId: string; data: SurveyOverview }) {
  const { t } = useTranslation('course');
  const choiceQs = data.questions.filter((q) => q.type !== 'text');
  const [search, setSearch] = useState('');
  const [qid, setQid] = useState('');
  const [choice, setChoice] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const q = useDebounced(search);
  useEffect(() => setPage(1), [q, qid, choice]);
  const res = useSurveyResponses(communityId, lessonId, { q: q || undefined, questionId: qid && choice ? qid : undefined, choice: qid && choice ? choice : undefined, page });
  const options = choiceQs.find((c) => c.id === qid)?.options ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('surveyResults.searchName')} aria-label={t('surveyResults.searchName')} className={`${searchCls} min-w-[180px] flex-1`} />
        {choiceQs.length > 0 && (
          <>
            <select value={qid} onChange={(e) => { setQid(e.target.value); setChoice(''); }} aria-label={t('surveyResults.filterQuestion')} className="h-10 max-w-full rounded-xl border-[1.5px] border-[#e7e0da] bg-white px-2 text-[13px] outline-0 focus:border-brand">
              <option value="">{t('surveyResults.filterNone')}</option>
              {choiceQs.map((cq) => (
                <option key={cq.id} value={cq.id}>{cq.text}</option>
              ))}
            </select>
            {qid && (
              <select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label={t('surveyResults.filterChoice')} className="h-10 max-w-full rounded-xl border-[1.5px] border-[#e7e0da] bg-white px-2 text-[13px] outline-0 focus:border-brand">
                <option value="">{t('surveyResults.filterChoicePh')}</option>
                {options.map((o) => (
                  <option key={o.text} value={o.text}>{o.text}</option>
                ))}
              </select>
            )}
          </>
        )}
      </div>
      {res.isError && <ErrorNote message={errText(res.error)} />}
      {res.data && (
        <>
          <p className="m-0 text-[12.5px] text-stone-500">{t('surveyResults.totalFound', { count: res.data.meta.total })}</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {res.data.data.length === 0 && <li className={`${cardCls} text-[13px] text-stone-500`}>{t('surveyEditor.noResponses')}</li>}
            {res.data.data.map((r) => {
              const isOpen = open === r.user.id;
              return (
                <li key={r.user.id} className={cardCls}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : r.user.id)} aria-expanded={isOpen} className="flex w-full items-center gap-2 text-left">
                    <Avatar url={r.user.avatarUrl} name={r.user.name} size={28} className="bg-brand/10 text-brand" />
                    <span className="text-[13.5px] font-bold">{r.user.name}</span>
                    <span className="ml-auto text-[11.5px] text-stone-400">{fmtDateTime(r.answeredAt)}</span>
                    <MaterialIcon name={isOpen ? 'expand_less' : 'expand_more'} size={20} />
                  </button>
                  {isOpen && (
                    <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0 text-[13px]">
                      {data.questions.map((qu, i) => {
                        const a = r.answers.find((x) => x.questionId === qu.id);
                        if (!a) return null;
                        return (
                          <li key={qu.id}>
                            <span className="text-stone-500">{i + 1}. {qu.text}: </span>
                            <span className="font-medium break-words whitespace-pre-wrap">{[...a.choices, ...(a.text ? [a.text] : [])].join(', ')}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          <Pager page={res.data.meta.page} totalPages={res.data.meta.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

/** Chi tiết kết quả MỘT khảo sát (mod+): Tổng quan (đếm bằng SQL) / Câu trả lời tự nhập / Từng học viên (phân trang + lọc) + tải CSV. */
export function SurveyDetailPage() {
  const { t } = useTranslation('course');
  const navigate = useNavigate();
  const { id: communityId = '', lessonId = '' } = useParams();
  const { data: course } = useCommunityDetail(communityId);
  const overview = useSurveyOverview(communityId, lessonId);
  const csv = useDownloadSurveyCsv(communityId, lessonId);
  const [tab, setTab] = useState<Tab>('overview');
  if (!course) return null;
  if (!isModPlus(course.viewerRole)) return <StaffOnly />;
  const data = overview.data;
  const tabs: Tab[] = ['overview', 'texts', 'people'];

  return (
    <main className="flex min-w-0 flex-col gap-4">
      <button type="button" onClick={() => navigate(communityHome(communityId, 'khao-sat'))} className={`${ghostBtn} self-start`}>
        <MaterialIcon name="arrow_back" size={18} /> {t('surveyResults.back')}
      </button>
      {overview.isPending && <p className="text-sm text-stone-400">{t('survey.loading')}</p>}
      {overview.isError && <ErrorNote message={errText(overview.error)} />}
      {overview.isSuccess && !data && <p className={`${cardCls} m-0 text-[14px] text-stone-600`}>{t('surveyResults.notFound')}</p>}
      {data && (
        <>
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="m-0 text-[22px] font-extrabold break-words">{data.lessonTitle}</h1>
              <p className="m-0 text-[13px] text-stone-500">{data.moduleTitle} · {t('surveyResults.summary', { n: data.responseCount, total: data.memberCount })}</p>
            </div>
            <button
              type="button"
              onClick={() => csv.mutate(undefined, { onSuccess: () => toast(t('surveyResults.csvDone')), onError: (e) => toast(errText(e), 'error') })}
              disabled={csv.isPending || data.responseCount === 0}
              className={`${ghostBtn} disabled:opacity-50`}
            >
              <MaterialIcon name="download" size={18} /> {t('surveyResults.csv')}
            </button>
          </div>
          <div className="flex gap-2" role="tablist">
            {tabs.map((key) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`h-10 rounded-xl px-4 text-[13.5px] font-semibold ${tab === key ? 'bg-brand text-white' : 'glass-chip text-stone-900'}`}>
                {t(`surveyResults.tabs.${key}`)}
              </button>
            ))}
          </div>
          {data.responseCount === 0 ? (
            <p className={`${cardCls} m-0 text-[14px] text-stone-600`}>{t('surveyEditor.noResponses')}</p>
          ) : tab === 'overview' ? (
            <OverviewTab data={data} />
          ) : tab === 'texts' ? (
            <TextsTab communityId={communityId} lessonId={lessonId} data={data} />
          ) : (
            <PeopleTab communityId={communityId} lessonId={lessonId} data={data} />
          )}
        </>
      )}
      <ToastHost />
    </main>
  );
}
