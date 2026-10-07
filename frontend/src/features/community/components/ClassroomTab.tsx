import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { communityCheckout, lessonPath } from '../../../lib/paths';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useCommunityDetail } from '../../courses/queries';
import { formatCompact } from '../../../lib/format';
import { useClaimCertificate, useCourseList, useLessons, useModules, useProgress, useToggleLessonComplete } from '../queries';
import type { Certificate, ClassroomModule } from '../types';
import { CertificateDialog } from './CertificateCard';
import { ClassroomEditor } from './ClassroomEditor';
import { ModuleWizard } from './ModuleWizard';
import { CourseManager, publishBadgeCls, publishLabel } from './CourseManager';
import { errText, ErrorNote, ghostBtn, isAdminPlus, isModPlus, primaryBtn, safeUrl, toast, ToastHost } from './contentUi';

function LessonList({ communityId, courseId, moduleId, payUrl }: { communityId: string; courseId: string; moduleId: string; payUrl?: string }) {
  const { t } = useTranslation('community');
  const lessons = useLessons(communityId, courseId, moduleId);
  const toggle = useToggleLessonComplete(communityId);

  if (lessons.isPending) return <p className="px-4 py-3 text-sm text-stone-400">{t('classroom.lessonList.loading')}</p>;
  if (lessons.isError) return <div className="p-3"><ErrorNote message={errText(lessons.error, t('classroom.lessonList.loadFailed'))} /></div>;
  if (lessons.data.length === 0) return <p className="px-4 py-3 text-sm text-stone-400">{t('classroom.lessonList.empty')}</p>;
  return (
    <div className="flex flex-col gap-1.5 border-t border-[rgba(120,60,20,.08)] bg-white/60 p-3">
      {lessons.data.map((l) => (
        <div key={l.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white">
          <button
            type="button"
            onClick={() => toggle.mutate(l.id, { onError: (e) => toast(errText(e), 'error') })}
            disabled={toggle.isPending || l.locked}
            aria-label={l.completed ? t('classroom.lessonList.markUndone', { title: l.title }) : t('classroom.lessonList.markDone', { title: l.title })}
            title={l.completed ? t('classroom.lessonList.titleUndone') : t('classroom.lessonList.titleDone')}
            className={`grid size-8 flex-none place-items-center rounded-full ${l.completed ? 'bg-brand text-white' : 'bg-stone-100 text-stone-500 hover:bg-brand/10'}`}
          >
            <MaterialIcon name="check" size={16} color={l.completed ? '#fff' : '#a8a29e'} />
          </button>
          <Link to={lessonPath(communityId, l.id)} className={`min-w-0 flex-1 ${l.locked ? 'pointer-events-none opacity-60' : ''}`} aria-disabled={l.locked}>
            <div className={`truncate text-[13.5px] font-medium hover:text-brand ${l.completed ? 'text-stone-400 line-through' : 'text-stone-900'}`}>{l.title}</div>
            <div className="text-[11.5px] text-stone-400">
              {t('classroom.lessonList.meta', { n: l.durationMin, type: l.type === 'video' ? t('editor.lesson.typeVideo') : l.type === 'file' ? t('editor.lesson.typeFile') : t('editor.lesson.typeText') })}
            </div>
          </Link>
          {l.locked ? (
            payUrl ? (
              <Link to={payUrl} aria-label={t('classroom.unlockBuy')} title={t('classroom.unlockBuy')} className="grid size-8 flex-none place-items-center rounded-full bg-brand/10 hover:bg-brand/20"><MaterialIcon name="lock" size={16} filled color="#f26a1b" /></Link>
            ) : (
              <span className="grid size-8 flex-none place-items-center rounded-full bg-stone-100"><MaterialIcon name="lock" size={16} filled color="#a8a29e" /></span>
            )
          ) : (
            <Link to={lessonPath(communityId, l.id)} aria-label={t('classroom.lessonList.learn', { title: l.title })} className="grid size-8 flex-none place-items-center rounded-full bg-brand/10 hover:bg-brand/20">
              <MaterialIcon name="play_arrow" size={18} filled color="#f26a1b" />
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

function lockText(m: ClassroomModule) {
  if (m.lockReason === 'level')
    return m.requiredLevel
      ? i18n.t('classroom.lock.levelReq', { ns: 'community', level: m.requiredLevel })
      : i18n.t('classroom.lock.levelHigher', { ns: 'community' });
  if (m.lockReason === 'paid') return i18n.t('modWizard.lock.paid', { ns: 'community', price: Math.round((m.priceCents ?? 0) / 100) });
  if (m.lockReason === 'selected') return i18n.t('modWizard.lock.selected', { ns: 'community' });
  return i18n.t('classroom.lock.prevModule', { ns: 'community' });
}

// Ảnh bìa module lấy từ file thiết kế gốc (slot module-img-0..8), ảnh đã có sẵn tiêu đề trong hình.
const MODULE_IMAGE_COUNT = 9;
const PAGE_SIZE = 9; // 3 hàng × 3 cột
export function ClassroomTab() {
  const { t } = useTranslation('community');
  const { id: communityId = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const { data: community } = useCommunityDetail(communityId);
  const courseList = useCourseList(communityId);
  const courses = courseList.data ?? [];
  const wanted = sp.get('khoa');
  // Khóa đang xem: theo ?khoa=, mặc định là khóa mặc định/khóa đã xuất bản đầu tiên.
  const selected =
    courses.find((c) => c.id === wanted) ??
    courses.find((c) => c.isDefault && c.publishStatus === 'published') ??
    courses.find((c) => c.publishStatus === 'published') ??
    courses[0];
  const courseId = selected?.id ?? null;
  const modules = useModules(communityId, courseId);
  const progress = useProgress(communityId, courseId);
  const claim = useClaimCertificate(communityId, courseId ?? '');
  const [openId, setOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const detailRef = useRef<HTMLDivElement>(null);
  // Bấm nút mũi tên: mở danh sách bài và cuộn tới ngay để thấy chi tiết (không phải kéo xuống cuối trang).
  const openModuleDetail = (id: string) => {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };
  const [editMode, setEditMode] = useState(false);
  const [cert, setCert] = useState<Certificate | null>(null);
  const [wizard, setWizard] = useState<ClassroomModule | 'new' | null>(null);

  const role = community?.viewerRole;
  const canEdit = isModPlus(role);

  const pickCourse = (id: string) => {
    setOpenId(null);
    setPage(1);
    setSp(id ? { khoa: id } : {}, { replace: true });
  };

  if (courseList.isPending) return <p className="py-10 text-center text-stone-400">{t('classroom.loading')}</p>;
  if (courseList.isError) return <ErrorNote message={errText(courseList.error, t('classroom.loadCoursesFailed'))} />;

  // Cộng đồng chưa có khóa học nào hiển thị được với người xem.
  if (!selected || !courseId) {
    return (
      <div className="flex flex-col gap-4">
        <ToastHost />
        <div className="glass flex flex-col items-center gap-2 rounded-3xl px-6 py-12 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-brand/10">
            <MaterialIcon name="school" size={30} filled color="#f26a1b" />
          </span>
          <h1 className="m-0 text-[22px] font-extrabold">{t('classroom.noCourses')}</h1>
          <p className="m-0 max-w-md text-sm text-stone-600">
            {canEdit ? t('classroom.createFirst') : t('classroom.noPublished')}
          </p>
        </div>
        {canEdit && (
          <div className="glass rounded-3xl p-4">
            <CourseManager communityId={communityId} isAdmin={isAdminPlus(role)} />
          </div>
        )}
      </div>
    );
  }

  if (modules.isPending) return <p className="py-10 text-center text-stone-400">{t('classroom.loading')}</p>;
  if (modules.isError) return <ErrorNote message={errText(modules.error, t('classroom.loadFailed'))} />;

  const list = modules.data ?? [];
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const shown = list.slice(start, start + PAGE_SIZE);
  const totalLessons = list.reduce((n, m) => n + m.lessonsCount, 0);
  const openModule = list.find((m) => m.id === openId);
  // Module đang khóa trong cộng đồng có phí (hoặc module bán riêng) → đưa người học sang trang thanh toán để mở khóa.
  const payUrlOf = (m: ClassroomModule) => (m.locked && !canEdit && (m.lockReason === 'paid' || (community?.priceUsd ?? 0) > 0) ? communityCheckout(communityId) : undefined);
  const prog = progress.data;
  const complete = !!prog && prog.totalLessons > 0 && prog.percent >= 100;
  const canClaim = complete && selected.certificatesEffective;

  return (
    <div className="flex flex-col gap-4">
      <ToastHost />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-1 py-1.5">
        <div className="min-w-0 flex-1 basis-[300px]">
          <h1 className="m-0 text-[32px] leading-tight font-extrabold tracking-tight">{t('classroom.title')}</h1>
          <p className="mt-1 mb-0 text-sm text-stone-700 [text-wrap:pretty]">{t('classroom.subtitle')}</p>
        </div>
        <div className="ml-auto flex items-center divide-x divide-stone-200/80 py-2">
          {[
            { icon: 'school', value: list.length, label: t('classroom.statModules') },
            { icon: 'article', value: totalLessons, label: t('classroom.statLessons') },
            { icon: 'group', value: formatCompact(community?.stats.members ?? 0), label: t('classroom.statStudents') },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2.5 px-5 first:pl-0 last:pr-0">
              <MaterialIcon name={s.icon} size={24} color="#f26a1b" />
              <div>
                <div className="text-[17px] leading-tight font-extrabold">{s.value}</div>
                <div className="mt-0.5 text-xs text-stone-600">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
        {canEdit && (
          <button type="button" onClick={() => setWizard('new')} className={`${primaryBtn} h-14 flex-none rounded-2xl px-6 text-[15px] whitespace-nowrap`}>
            <MaterialIcon name="add" size={22} color="#fff" />
            {t('classroom.addLesson')}
          </button>
        )}
      </div>

      {/* Chọn khóa học: chỉ hiện khi cộng đồng có nhiều hơn 1 khóa */}
      {courses.length > 1 && (
        <nav aria-label={t('classroom.pickCourse')} className="flex gap-3 overflow-x-auto pb-1">
          {courses.map((c) => {
            const active = c.id === selected.id;
            const thumb = safeUrl(c.thumbnailUrl ?? undefined);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => pickCourse(c.id)}
                aria-current={active ? 'true' : undefined}
                className={`glass flex w-[250px] flex-none items-center gap-3 rounded-2xl p-2.5 text-left transition-transform hover:-translate-y-0.5 ${active ? 'ring-2 ring-brand' : ''}`}
              >
                <span className="grid size-[52px] flex-none place-items-center overflow-hidden rounded-xl bg-brand/10">
                  {thumb ? <img src={thumb} alt="" className="size-full object-cover" /> : <MaterialIcon name="school" size={26} filled color="#f26a1b" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold">{c.title}</span>
                  <span className="block truncate text-[11.5px] text-stone-500">
                    {t('classroom.courseMeta', { modules: c.modulesCount, lessons: c.lessonsCount })}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(120,60,20,.08)]">
                      <span className="block h-full rounded-full bg-brand" style={{ width: `${c.progress.percent}%` }} />
                    </span>
                    <span className="text-[11px] font-bold">{c.progress.percent}%</span>
                  </span>
                  {c.publishStatus !== 'published' && (
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${publishBadgeCls(c.publishStatus)}`}>{publishLabel(c.publishStatus)}</span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Tiến độ khóa học + Tiếp tục học + Chứng nhận + Chế độ chỉnh sửa */}
      <div className="glass flex flex-wrap items-center gap-4 rounded-2xl p-4">
        <div className="min-w-[220px] flex-1">
          <div className="flex items-center justify-between text-[13px]">
            <span className="truncate font-semibold">{courses.length > 1 ? t('classroom.progressNamed', { title: selected.title }) : t('classroom.progress')}</span>
            <span className="text-stone-500">
              {prog ? t('classroom.progressLine', { done: prog.completedLessons, total: prog.totalLessons, modules: prog.completedModules }) : progress.isPending ? t('common.loading') : '—'}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2.5">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[rgba(120,60,20,.08)]" role="progressbar" aria-valuenow={prog?.percent ?? 0} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${prog?.percent ?? 0}%` }} />
            </div>
            <span className="w-11 text-right text-[13px] font-bold">{prog?.percent ?? 0}%</span>
          </div>
        </div>
        {prog?.nextLesson && (
          <Link to={lessonPath(communityId, prog.nextLesson.id)} className={primaryBtn} title={prog.nextLesson.title}>
            <MaterialIcon name="play_arrow" size={19} filled color="#fff" />
            {t('classroom.continue')}
          </Link>
        )}
        {canClaim && (
          <button
            type="button"
            disabled={claim.isPending}
            onClick={() => claim.mutate(undefined, { onSuccess: setCert, onError: (e) => toast(errText(e), 'error') })}
            className={ghostBtn}
          >
            <MaterialIcon name="workspace_premium" size={19} filled color="#f26a1b" />
            {claim.isPending ? t('classroom.issuing') : t('classroom.claim')}
          </button>
        )}
        {complete && !selected.certificatesEffective && (
          <span className="text-[12.5px] text-stone-500">{t('classroom.certDisabled')}</span>
        )}
        {canEdit && (
          <button type="button" onClick={() => setEditMode((e) => !e)} className={editMode ? primaryBtn : ghostBtn} aria-pressed={editMode}>
            <MaterialIcon name={editMode ? 'close' : 'edit_note'} size={19} color={editMode ? '#fff' : undefined} />
            {editMode ? t('classroom.exitEdit') : t('classroom.editClassroom')}
          </button>
        )}
      </div>

      {canEdit && editMode && <>
          <div className="glass rounded-3xl p-4"><CourseManager communityId={communityId} isAdmin={isAdminPlus(role)} /></div>
          <ClassroomEditor communityId={communityId} course={selected} modules={list} isAdmin={isAdminPlus(role)} />
        </>}

      {list.length === 0 && !editMode && <p className="glass rounded-2xl py-10 text-center text-stone-500">{t('classroom.empty')}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((m) => {
          const thumb = safeUrl(m.thumbnail) ?? `/images/community/module-img-${(m.index - 1 + MODULE_IMAGE_COUNT) % MODULE_IMAGE_COUNT}.webp`;
          return (
            <article
              key={m.id}
              className={`glass flex flex-col overflow-hidden rounded-[20px] transition-transform hover:-translate-y-0.5 ${openId === m.id ? 'ring-2 ring-brand' : ''}`}
            >
              <div className="relative h-[156px] overflow-hidden bg-[#110d0b]">
                <img src={thumb} alt={m.title} className="size-full object-cover" />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setWizard(m)}
                    title={t('classroom.editModuleTitle')}
                    className="absolute top-3 right-3 z-[3] flex h-[34px] items-center gap-1.5 rounded-[10px] bg-white/95 px-3 text-[13px] font-bold shadow-[0_6px_16px_rgba(0,0,0,.18)] hover:bg-white hover:text-brand"
                  >
                    <MaterialIcon name="edit" size={17} />
                    {t('classroom.editBtn')}
                  </button>
                )}
                {m.publishStatus === 'draft' && (
                  <span className="absolute top-3 left-3 z-[3] rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{t('modWizard.lock.draft')}</span>
                )}
                {m.locked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[rgba(12,8,6,.62)] px-5 text-center text-sm font-bold text-white backdrop-blur-[2px]">
                    <span className="grid size-11 place-items-center rounded-full border border-white/25 bg-white/15">
                      <MaterialIcon name="lock" size={24} filled color="#fff" />
                    </span>
                    {lockText(m)}
                    {payUrlOf(m) && (
                      <Link to={payUrlOf(m)!} className="mt-1 rounded-xl bg-brand px-4 py-1.5 text-[13px] font-bold text-white hover:opacity-90">
                        {t('classroom.unlockBuy')}
                      </Link>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 px-[18px] pt-3.5 pb-4">
                <div className="truncate text-[15.5px] font-bold">#{m.index - 1}: {m.title}</div>
                <div className="truncate text-[12.5px] text-stone-500">{t('classroom.lessonsDesc', { n: m.lessonsCount, desc: m.description })}</div>
                <div className="mt-auto flex items-center gap-2.5 pt-2.5">
                  <span className="rounded-lg bg-brand/10 px-2 py-1 text-[11.5px] font-bold">{m.pct}%</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[rgba(120,60,20,.08)]">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${m.pct}%` }} />
                  </div>
                  {payUrlOf(m) && !(m.hasPreview && m.lockReason !== 'previous_module') ? (
                    <Link to={payUrlOf(m)!} aria-label={t('classroom.unlockBuy')} title={t('classroom.unlockBuy')} className="grid size-[42px] flex-none place-items-center rounded-[14px] bg-brand/10 hover:bg-brand/20">
                      <MaterialIcon name="lock_open" size={22} color="#f26a1b" />
                    </Link>
                  ) : (
                  <button
                    type="button"
                    disabled={m.locked && !(m.hasPreview && m.lockReason !== 'previous_module')}
                    onClick={() => openModuleDetail(m.id)}
                    aria-label={t('classroom.openAria', { title: m.title })}
                    title={m.locked ? lockText(m) : undefined}
                    className="grid size-[42px] flex-none place-items-center rounded-[14px] bg-brand/10 hover:bg-brand/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <MaterialIcon name="arrow_forward" size={22} color="#f26a1b" />
                  </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {openModule && (
        <div ref={detailRef} className="glass scroll-mt-24 overflow-hidden rounded-2xl">
          <div className="px-4 py-3 text-[15px] font-bold">#{openModule.index}: {openModule.title}</div>
          <LessonList communityId={communityId} courseId={courseId} moduleId={openModule.id} payUrl={payUrlOf(openModule)} />
        </div>
      )}

      <div className="flex items-center justify-between text-[13px] text-stone-600">
        <div className="flex items-center gap-1">
          <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-2 py-1 disabled:opacity-40">{t('classroom.prev')}</button>
          {Array.from({ length: totalPages }, (_, n) => n + 1).map((n) => (
            <button key={n} onClick={() => setPage(n)} className={`size-8 rounded-full font-semibold ${n === page ? 'bg-brand text-white' : ''}`}>
              {n}
            </button>
          ))}
          <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="px-2 py-1 disabled:opacity-40">{t('classroom.next')}</button>
        </div>
        <span>{list.length ? t('classroom.range', { from: start + 1, to: start + shown.length, total: list.length }) : ''}</span>
      </div>

      {wizard && <ModuleWizard communityId={communityId} courseId={courseId} module={wizard === 'new' ? null : wizard} onClose={() => setWizard(null)} />}
      {cert && <CertificateDialog cert={cert} onClose={() => setCert(null)} />}
    </div>
  );
}
