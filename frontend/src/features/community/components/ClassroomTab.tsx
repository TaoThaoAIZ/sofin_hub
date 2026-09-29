import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useCourseDetail } from '../../courses/queries';
import { formatCompact } from '../../../lib/format';
import { useClaimCertificate, useClassroomSettings, useLessons, useModules, useProgress, useToggleLessonComplete } from '../queries';
import type { Certificate, ClassroomModule } from '../types';
import { CertificateDialog } from './CertificateCard';
import { ClassroomEditor } from './ClassroomEditor';
import { errText, ErrorNote, ghostBtn, isAdminPlus, isModPlus, primaryBtn, safeUrl, toast, ToastHost } from './contentUi';

function LessonList({ courseId, moduleId }: { courseId: string; moduleId: string }) {
  const lessons = useLessons(courseId, moduleId);
  const toggle = useToggleLessonComplete(courseId, moduleId);

  if (lessons.isPending) return <p className="px-4 py-3 text-sm text-stone-400">Đang tải bài học…</p>;
  if (lessons.isError) return <div className="p-3"><ErrorNote message={errText(lessons.error, 'Không tải được bài học')} /></div>;
  if (lessons.data.length === 0) return <p className="px-4 py-3 text-sm text-stone-400">Module này chưa có bài học.</p>;
  return (
    <div className="flex flex-col gap-1.5 border-t border-[rgba(120,60,20,.08)] bg-white/60 p-3">
      {lessons.data.map((l) => (
        <div key={l.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white">
          <button
            type="button"
            onClick={() => toggle.mutate(l.id, { onError: (e) => toast(errText(e), 'error') })}
            disabled={toggle.isPending}
            aria-label={l.completed ? `Bỏ hoàn thành: ${l.title}` : `Đánh dấu hoàn thành: ${l.title}`}
            title={l.completed ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
            className={`grid size-8 flex-none place-items-center rounded-full ${l.completed ? 'bg-brand text-white' : 'bg-stone-100 text-stone-500 hover:bg-brand/10'}`}
          >
            <MaterialIcon name="check" size={16} color={l.completed ? '#fff' : '#a8a29e'} />
          </button>
          <Link to={`/courses/${courseId}/community/lop-hoc/${l.id}`} className="min-w-0 flex-1">
            <div className={`truncate text-[13.5px] font-medium hover:text-brand ${l.completed ? 'text-stone-400 line-through' : 'text-stone-900'}`}>{l.title}</div>
            <div className="text-[11.5px] text-stone-400">
              {l.durationMin} phút · {l.type === 'video' ? 'Video' : l.type === 'file' ? 'Tệp' : 'Bài đọc'}
            </div>
          </Link>
          <Link to={`/courses/${courseId}/community/lop-hoc/${l.id}`} aria-label={`Học bài ${l.title}`} className="grid size-8 flex-none place-items-center rounded-full bg-brand/10 hover:bg-brand/20">
            <MaterialIcon name="play_arrow" size={18} filled color="#f26a1b" />
          </Link>
        </div>
      ))}
    </div>
  );
}

function lockText(m: ClassroomModule) {
  if (m.lockReason === 'level') return m.requiredLevel ? `Cần đạt Cấp độ ${m.requiredLevel}` : 'Cần đạt cấp độ cao hơn';
  return 'Hoàn thành module trước';
}

// Ảnh bìa module lấy từ file thiết kế gốc (slot module-img-0..8), ảnh đã có sẵn tiêu đề trong hình.
const MODULE_IMAGE_COUNT = 9;
const PAGE_SIZE = 10;

export function ClassroomTab() {
  const { id: courseId = '' } = useParams();
  const modules = useModules(courseId);
  const { data: course } = useCourseDetail(courseId);
  const progress = useProgress(courseId);
  const settings = useClassroomSettings(courseId);
  const claim = useClaimCertificate(courseId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [cert, setCert] = useState<Certificate | null>(null);

  const role = course?.viewerRole;
  const canEdit = isModPlus(role);

  if (modules.isPending) return <p className="py-10 text-center text-stone-400">Đang tải lớp học…</p>;
  if (modules.isError) return <ErrorNote message={errText(modules.error, 'Không tải được lớp học')} />;

  const list = modules.data ?? [];
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const shown = list.slice(start, start + PAGE_SIZE);
  const totalLessons = list.reduce((n, m) => n + m.lessonsCount, 0);
  const openModule = list.find((m) => m.id === openId);
  const prog = progress.data;
  const complete = !!prog && prog.totalLessons > 0 && prog.percent >= 100;
  const canClaim = complete && !!settings.data?.certificatesEnabled;

  return (
    <div className="flex flex-col gap-4">
      <ToastHost />
      <div className="relative flex min-h-[128px] flex-wrap items-center gap-5 overflow-hidden rounded-[28px] border border-brand/15 bg-gradient-to-r from-[#fff7f0] via-[#ffe9d9] to-[#ffdcc4] px-6 py-[22px]">
        <img src="/images/community/class-hero-bg.webp" alt="" className="pointer-events-none absolute inset-0 size-full object-cover" />
        <div className="relative flex items-center gap-4">
          <span className="grid size-[60px] flex-none place-items-center rounded-full bg-white/80 shadow-[0_6px_18px_rgba(242,106,27,.18)]">
            <MaterialIcon name="school" size={32} filled color="#f26a1b" />
          </span>
          <div>
            <h1 className="m-0 text-[32px] leading-tight font-extrabold tracking-tight">Lớp học</h1>
            <p className="mt-1 text-sm text-stone-700">Học theo lộ trình module — hoàn thành module trước để mở khóa module tiếp theo.</p>
          </div>
        </div>
        <div className="relative grid grid-cols-3 divide-x divide-brand/15 ml-auto rounded-[18px] border border-white/75 bg-white/45 py-3 text-center backdrop-blur-xl">
          {[
            { icon: 'school', value: list.length, label: 'Module' },
            { icon: 'article', value: totalLessons, label: 'Bài học' },
            { icon: 'group', value: formatCompact(course?.stats.members ?? 0), label: 'Học viên' },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2.5 px-5">
              <MaterialIcon name={s.icon} size={22} color="#f26a1b" />
              <div className="text-left">
                <div className="text-[17px] leading-tight font-extrabold">{s.value}</div>
                <div className="text-[11.5px] text-stone-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tiến độ khóa học + Tiếp tục học + Chứng nhận + Chế độ chỉnh sửa */}
      <div className="glass flex flex-wrap items-center gap-4 rounded-2xl p-4">
        <div className="min-w-[220px] flex-1">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-semibold">Tiến độ khóa học</span>
            <span className="text-stone-500">
              {prog ? `${prog.completedLessons}/${prog.totalLessons} bài · ${prog.completedModules} module` : progress.isPending ? 'Đang tải…' : '—'}
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
          <Link to={`/courses/${courseId}/community/lop-hoc/${prog.nextLesson.id}`} className={primaryBtn} title={prog.nextLesson.title}>
            <MaterialIcon name="play_arrow" size={19} filled color="#fff" />
            Tiếp tục học
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
            {claim.isPending ? 'Đang cấp…' : 'Nhận chứng nhận'}
          </button>
        )}
        {complete && settings.data && !settings.data.certificatesEnabled && (
          <span className="text-[12.5px] text-stone-500">Cộng đồng chưa bật chứng nhận hoàn thành.</span>
        )}
        {canEdit && (
          <button type="button" onClick={() => setEditMode((e) => !e)} className={editMode ? primaryBtn : ghostBtn} aria-pressed={editMode}>
            <MaterialIcon name={editMode ? 'close' : 'edit_note'} size={19} color={editMode ? '#fff' : undefined} />
            {editMode ? 'Thoát chỉnh sửa' : 'Chỉnh sửa lớp học'}
          </button>
        )}
      </div>

      {canEdit && editMode && <ClassroomEditor courseId={courseId} modules={list} isAdmin={isAdminPlus(role)} />}

      {list.length === 0 && !editMode && <p className="glass rounded-2xl py-10 text-center text-stone-500">Lớp học chưa có nội dung.</p>}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
        {shown.map((m) => {
          const thumb = safeUrl(m.thumbnail) ?? `/images/community/module-img-${(m.index - 1 + MODULE_IMAGE_COUNT) % MODULE_IMAGE_COUNT}.webp`;
          return (
            <article
              key={m.id}
              className={`glass flex flex-col overflow-hidden rounded-[20px] transition-transform hover:-translate-y-0.5 ${openId === m.id ? 'ring-2 ring-brand' : ''}`}
            >
              <div className="relative h-[156px] overflow-hidden bg-[#110d0b]">
                <img src={thumb} alt={m.title} className="size-full object-cover" />
                {m.locked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[rgba(12,8,6,.62)] px-5 text-center text-sm font-bold text-white backdrop-blur-[2px]">
                    <span className="grid size-11 place-items-center rounded-full border border-white/25 bg-white/15">
                      <MaterialIcon name="lock" size={24} filled color="#fff" />
                    </span>
                    {lockText(m)}
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 px-[18px] pt-3.5 pb-4">
                <div className="truncate text-[15.5px] font-bold">#{m.index - 1}: {m.title}</div>
                <div className="truncate text-[12.5px] text-stone-500">{m.lessonsCount} bài học • {m.description}</div>
                <div className="mt-auto flex items-center gap-2.5 pt-2.5">
                  <span className="rounded-lg bg-brand/10 px-2 py-1 text-[11.5px] font-bold">{m.pct}%</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[rgba(120,60,20,.08)]">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${m.pct}%` }} />
                  </div>
                  <button
                    type="button"
                    disabled={m.locked}
                    onClick={() => setOpenId(openId === m.id ? null : m.id)}
                    aria-label={`Mở ${m.title}`}
                    title={m.locked ? lockText(m) : undefined}
                    className="grid size-[42px] flex-none place-items-center rounded-[14px] bg-brand/10 hover:bg-brand/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <MaterialIcon name="arrow_forward" size={22} color="#f26a1b" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {openModule && (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="px-4 py-3 text-[15px] font-bold">#{openModule.index}: {openModule.title}</div>
          <LessonList courseId={courseId} moduleId={openModule.id} />
        </div>
      )}

      <div className="flex items-center justify-between text-[13px] text-stone-600">
        <div className="flex items-center gap-1">
          <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-2 py-1 disabled:opacity-40">‹ Trước</button>
          {Array.from({ length: totalPages }, (_, n) => n + 1).map((n) => (
            <button key={n} onClick={() => setPage(n)} className={`size-8 rounded-full font-semibold ${n === page ? 'bg-brand text-white' : ''}`}>
              {n}
            </button>
          ))}
          <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="px-2 py-1 disabled:opacity-40">Tiếp theo ›</button>
        </div>
        <span>{list.length ? `${start + 1}–${start + shown.length} trên ${list.length}` : ''}</span>
      </div>

      {cert && <CertificateDialog cert={cert} onClose={() => setCert(null)} />}
    </div>
  );
}
