import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import i18n from '../i18n';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { Button, ButtonLink } from '../components/ui/Button';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { PathIcon, StarIcon, UserIcon } from '../components/ui/icons';
import { SectionTitle } from '../components/ui/SectionTitle';
import { useAuth } from '../features/auth/AuthContext';
import { TAG_UI } from '../features/courses/constants';
import { useCategories, useCommunityDetail, useToggleEnrollment } from '../features/courses/queries';
import type { CommunityDetail, CourseFaq, CourseHighlight } from '../features/courses/types';
import { ApiError } from '../lib/api';
import { formatCompact } from '../lib/format';
import { JoinDialog } from '../features/payments/components/JoinDialog';
import { JoinRequestDialog, loadPendingRequestId, savePendingRequestId } from '../features/communities/components/JoinRequestDialog';
import { errorText } from '../features/communities/components/Modal';
import { ReviewsSection } from '../features/communities/components/ReviewsSection';
import { useCancelJoinRequest } from '../features/communities/queries';
import { toast, ToastHost } from '../features/community/components/contentUi';
import { isAtLeast } from '../features/communities/types';
import { usePopup } from '../components/ui/usePopup';

type TabKey = 'overview' | 'content' | 'faq';
const TABS: { key: TabKey | 'reviews' }[] = [{ key: 'overview' }, { key: 'content' }, { key: 'reviews' }, { key: 'faq' }];

/** Danh sách quyền lợi chỉ gồm điều thật: số bài học thật, cộng đồng, và ghi chú giá/dùng thử từ API. */
function sidebarPerks(course: CommunityDetail): string[] {
  const lessons = Number(course.facts.find((f) => f.label === 'Bài học')?.value ?? 0);
  return [
    ...(lessons > 0 ? [i18n.t('detail.perkLessons', { ns: 'course', n: lessons })] : []),
    i18n.t('detail.perkDiscuss', { ns: 'course' }),
    ...course.priceNotes,
  ];
}

export function CourseDetailPage() {
  const { t } = useTranslation('course');
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { confirm } = usePopup();
  const { status } = useAuth();
  const { data: categories = [] } = useCategories();
  const { data: course, isPending, error } = useCommunityDetail(id);
  const enroll = useToggleEnrollment(id);
  const [tab, setTab] = useState<TabKey>('overview');
  const [showPaidDialog, setShowPaidDialog] = useState(false);
  const reviewsRef = useRef<HTMLDivElement>(null);
  // Luồng cộng đồng riêng tư: hộp thoại gửi yêu cầu + trạng thái yêu cầu đang chờ ('unknown' = biết là đang chờ nhưng không còn id để hủy)
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<string | null>(() => loadPendingRequestId(id));
  const [joinNotice, setJoinNotice] = useState<string | null>(null);
  const cancelRequest = useCancelJoinRequest();
  useEffect(() => {
    setPendingRequest(loadPendingRequestId(id));
    setJoinNotice(null);
  }, [id]);
  // Đã vào được cộng đồng (duyệt xong/tham gia bằng cách khác) → bỏ trạng thái chờ đã nhớ.
  useEffect(() => {
    if (course?.viewerEnrolled && pendingRequest) {
      savePendingRequestId(id, null);
      setPendingRequest(null);
    }
  }, [course?.viewerEnrolled, pendingRequest, id]);

  if (isPending) {
    return (
      <div className="min-h-screen bg-white">
        <Header active="courses" />
        <p className="py-24 text-center text-stone-500">{t('detail.loading')}</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-white">
        <Header active="courses" />
        <div className="grid place-items-center px-4 py-24 text-center">
          <div>
            <p className="text-2xl font-bold">{t('detail.notFoundTitle')}</p>
            <p className="mt-2 text-stone-600">{t('detail.notFoundDesc')}</p>
            <ButtonLink to="/" className="mt-6 h-10 rounded-[14px] px-[18px] text-sm font-semibold">
              {t('detail.home')}
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  const tag = course.tag ? TAG_UI[course.tag] : null;
  const categoryName = categories.find((c) => c.id === course.category)?.name ?? course.category;
  const priceLabel = course.priceUsd === 0 ? t('detail.free') : `$${course.priceUsd}`;

  const scrollToReviews = () =>
    reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const isPrivate = course.visibility === 'private';
  const canJoinFlow = !course.viewerEnrolled;
  const hasPendingRequest = canJoinFlow && pendingRequest !== null;
  const isLocked = !!course.locked;

  const onJoinError = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : undefined;
    if (code === 'JOIN_REQUEST_REQUIRED') {
      // Cộng đồng riêng tư: phải xin phép, không tham gia thẳng được.
      if (pendingRequest === null) setShowRequestDialog(true);
      return;
    }
    if (code === 'PAYMENT_REQUIRED') {
      setShowPaidDialog(true);
      return;
    }
    if (code === 'COMMUNITY_LOCKED') {
      setJoinNotice(t('detail.locked'));
      return;
    }
    setJoinNotice(errorText(err)); // gồm cả 403 "bị cấm khỏi cộng đồng"
  };

  const handleJoin = async () => {
    setJoinNotice(null);
    if (status !== 'authenticated') {
      navigate('/login', { state: { from: `/communities/${id}` } });
      return;
    }
    // Đã tham gia rồi: giữ nguyên hành vi toggle rời khóa học hiện có, không đổi.
    if (course.viewerEnrolled) {
      // Cộng đồng có phí: rời = mất quyền truy cập ngay và gói bị hủy vào cuối kỳ (không bị trừ kỳ sau, tiền kỳ đã trả không hoàn).
      if (
        course.priceUsd > 0 &&
        !(await confirm({
          title: t('detail.leaveTitle'),
          tone: 'warning',
          confirmText: t('detail.leaveConfirm'),
          cancelText: t('detail.leaveCancel'),
          message: t('detail.leaveMessage'),
        }))
      )
        return;
      enroll.mutate(undefined, { onSuccess: () => toast(t('detail.leftToast')), onError: (e) => setJoinNotice(errorText(e)) });
      return;
    }
    // Đã gửi yêu cầu, đang chờ duyệt: không gửi lại.
    if (hasPendingRequest) return;
    // Cộng đồng riêng tư: để BE quyết (403 JOIN_REQUEST_REQUIRED → hộp thoại gửi yêu cầu).
    if (isPrivate) {
      enroll.mutate(undefined, { onSuccess: () => navigate(`/communities/${id}/community`), onError: onJoinError });
      return;
    }
    // Chưa tham gia + khóa học có phí: hiện dialog xác nhận trước khi sang trang thanh toán
    // (tham khảo flow skool.com), thay vì tham gia thẳng như khóa miễn phí.
    if (course.priceUsd > 0) {
      setShowPaidDialog(true);
      return;
    }
    enroll.mutate(undefined, { onSuccess: () => navigate(`/communities/${id}/community`), onError: onJoinError });
  };

  const handleCancelRequest = () => {
    if (!pendingRequest || pendingRequest === 'unknown') return;
    cancelRequest.mutate(pendingRequest, {
      onSuccess: () => {
        savePendingRequestId(id, null);
        setPendingRequest(null);
      },
      onError: (e) => {
        // 404/409: yêu cầu đã được xử lý hoặc không còn → bỏ trạng thái chờ để người dùng gửi lại được.
        if (e instanceof ApiError && (e.status === 404 || e.status === 409)) {
          savePendingRequestId(id, null);
          setPendingRequest(null);
        }
      },
    });
  };

  return (
    <div
      className="min-h-screen bg-white"
      style={{
        background:
          'radial-gradient(700px 500px at 0% 30%, rgba(255,186,140,.3), transparent 70%), radial-gradient(700px 600px at 100% 20%, rgba(255,200,160,.3), transparent 70%), radial-gradient(800px 600px at 60% 100%, rgba(251,207,232,.28), transparent 70%), #fff',
      }}
    >
      <Header active="courses" />

      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2.5 px-4 pt-5 text-[13px] text-stone-600 md:px-10">
        <Link to="/" className="grid place-items-center text-brand" aria-label={t('detail.homeAria')}>
          <PathIcon d="M12 3 3 10.5V21h6v-6h6v6h6V10.5z" fill="#f26a1b" size={16} />
        </Link>
        <span>›</span>
        <Link to="/" className="text-stone-600 hover:text-brand">
          {categoryName}
        </Link>
        <span>›</span>
        <span className="font-medium text-stone-900">{course.title}</span>
      </div>

      <div className="mx-auto flex max-w-[1400px] flex-wrap items-start gap-7 px-4 pt-4 md:px-10">
        <main className="flex min-w-0 flex-[999_1_620px] flex-col gap-[22px]">
          <div className="relative aspect-[16/8] overflow-hidden rounded-3xl bg-[#2a1a10] shadow-[0_20px_50px_rgba(120,60,20,.16)]">
            <img src={course.thumbnail} alt={course.title} className="size-full object-cover" />
            {tag && (
              <span
                className="absolute top-[18px] left-[18px] flex items-center gap-1.5 rounded-full border border-white/50 px-3.5 py-1.5 text-sm font-semibold"
                style={{ background: tag.bg, color: tag.fg, boxShadow: `0 6px 16px color-mix(in srgb, ${tag.bg} 45%, transparent)` }}
              >
                {t(tag.labelKey)}
              </span>
            )}
          </div>

          <div>
            <h1 className="m-0 text-[clamp(28px,2.6vw,38px)] font-extrabold tracking-[-1px]">{course.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-[18px] gap-y-2.5 text-sm text-stone-600">
              <span className="flex items-center gap-2">
                <StarIcon size={20} />
                <span>
                  <b className="text-stone-900">{course.rating}</b> ({course.ratingCount})
                </span>
              </span>
              <span className="flex items-center gap-2">
                <UserIcon size={18} />
                <Trans t={t} i18nKey="detail.by" values={{ name: course.instructor.name }} components={{ b: <b className="text-stone-900" /> }} />
              </span>
            </div>
            <p className="mt-3.5 max-w-[760px] text-base leading-[1.65] text-stone-700 text-pretty">
              {course.description}
            </p>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
            {course.facts.map((f) => (
              <div
                key={f.label}
                className="glass-chip flex items-center gap-3 rounded-[18px] p-3.5"
              >
                <div className="grid size-10 flex-none place-items-center rounded-xl" style={{ background: f.bg }}>
                  <PathIcon d={f.icon} stroke={f.fg} size={20} />
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-bold whitespace-nowrap">{f.value}</div>
                  <div className="text-xs whitespace-nowrap text-stone-500">{f.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-[rgba(120,60,20,.1)]">
            {TABS.filter((tb) => tb.key !== 'faq' || course.faqs.length > 0).map((tb) => {
              const isActive = tb.key === tab;
              return (
                <button
                  key={tb.key}
                  type="button"
                  onClick={() => (tb.key === 'reviews' ? scrollToReviews() : setTab(tb.key))}
                  className={`h-12 border-0 border-b-[2.5px] bg-transparent px-5 text-[15px] whitespace-nowrap ${
                    isActive ? 'border-brand font-bold text-brand' : 'border-transparent font-medium text-stone-700'
                  }`}
                >
                  {t(`detail.tabs.${tb.key}`)}
                </button>
              );
            })}
          </div>

          {tab === 'overview' && <OverviewTab course={course} priceLabel={priceLabel} />}
          {tab === 'content' && <ContentTab courseId={id} enrolled={!!course.viewerEnrolled} lessons={Number(course.facts.find((f) => f.label === 'Bài học')?.value ?? 0)} />}
          {tab === 'faq' && course.faqs.length > 0 && <FaqTab faqs={course.faqs} />}
        </main>

        <aside className="sticky top-24 flex min-w-0 flex-1 basis-[320px] flex-col gap-4 max-lg:static max-lg:basis-full">
          <div className="glass rounded-[26px] p-2">
            <div className="relative h-[190px] overflow-hidden rounded-[20px]">
              <img src={course.thumbnail} alt="" className="size-full object-cover" />
            </div>
            <div className="flex flex-col gap-4 px-3 pt-[18px] pb-3">
              <div className="flex items-center justify-between gap-2.5">
                <div className="text-[40px] leading-none font-extrabold tracking-[-1px] text-brand">
                  {priceLabel}
                  {course.priceUsd > 0 && <span className="text-lg font-semibold">{t('detail.perMonth')}</span>}
                </div>
              </div>

              <div className="grid grid-cols-3 text-center">
                {[
                  { v: formatCompact(course.stats.members), l: t('detail.members') },
                  { v: course.stats.online, l: t('detail.online') },
                  { v: course.stats.admins, l: t('detail.admins') },
                ].map((s, i) => (
                  <div key={s.l} className={i ? 'border-l border-[rgba(120,60,20,.1)]' : ''}>
                    <div className="text-xl font-bold">{s.v}</div>
                    <div className="mt-0.5 text-xs text-stone-500">{s.l}</div>
                  </div>
                ))}
              </div>

              {isLocked && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-[13px] font-medium text-red-700">
                  {t('detail.lockedBanner')}
                </p>
              )}
              {course.viewerEnrolled && !isLocked && (
                <ButtonLink to={`/communities/${id}/community`} className="h-[52px] gap-2.5 rounded-2xl text-base font-bold">
                  {t('detail.enter')}
                  <MaterialIcon name="arrow_forward" size={20} color="#fff" />
                </ButtonLink>
              )}
              {course.viewerEnrolled && !isLocked && course.viewerRole !== 'owner' && (
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={enroll.isPending}
                  className="h-11 rounded-2xl border-[1.5px] border-red-200 bg-white text-[15px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {enroll.isPending ? t('detail.leaving') : t('detail.leave')}
                </button>
              )}
              {!course.viewerEnrolled && (
              <Button
                onClick={handleJoin}
                disabled={enroll.isPending || hasPendingRequest}
                variant={course.viewerEnrolled ? 'success' : 'brand'}
                className="h-[52px] gap-2.5 rounded-2xl text-base font-bold"
              >
                {course.viewerEnrolled
                  ? t('detail.joined')
                  : hasPendingRequest
                    ? t('detail.requestPending')
                    : isPrivate
                      ? t('detail.requestJoin')
                      : t('detail.joinNow')}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <path d={course.viewerEnrolled ? 'M5 12l5 5 9-10' : 'M5 12h14M13 6l6 6-6 6'} />
                </svg>
              </Button>
              )}
              {isPrivate && !course.viewerEnrolled && !hasPendingRequest && (
                <p className="text-center text-xs text-stone-500">{t('detail.privateNote')}</p>
              )}
              {hasPendingRequest && (
                <div className="flex flex-col items-center gap-1.5 text-center text-[13px] text-stone-600">
                  <span>{t('detail.reviewNote')}</span>
                  {pendingRequest !== 'unknown' && (
                    <button
                      type="button"
                      onClick={handleCancelRequest}
                      disabled={cancelRequest.isPending}
                      className="font-semibold text-brand hover:underline disabled:opacity-50"
                    >
                      {cancelRequest.isPending ? t('detail.canceling') : t('detail.cancelRequest')}
                    </button>
                  )}
                  {cancelRequest.isError && <span className="text-red-600">{errorText(cancelRequest.error)}</span>}
                </div>
              )}
              {joinNotice && <p className="text-center text-sm text-red-600">{joinNotice}</p>}
              {isAtLeast(course.viewerRole, 'admin') && (
                <Link
                  to={`/communities/${id}/community/cai-dat`}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl bg-brand/10 text-sm font-semibold text-brand hover:bg-brand/15"
                >
                  <MaterialIcon name="settings" size={18} color="#f26a1b" />
                  {t('detail.settings')}
                </Link>
              )}
            </div>
          </div>

          <div className="glass rounded-[22px] p-5">
            <div className="mb-3.5 text-[17px] font-bold">{t('detail.youGet')}</div>
            <div className="flex flex-col gap-3.5">
              {sidebarPerks(course).map((p) => (
                <div key={p} className="flex items-center gap-3 text-[15px] text-stone-800">
                  <span className="bg-brand-gradient grid size-[26px] flex-none place-items-center rounded-full shadow-[0_4px_10px_rgba(242,106,27,.3)]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5 9-10" />
                    </svg>
                  </span>
                  {p}
                </div>
              ))}
            </div>
          </div>

          <div className="glass flex flex-col gap-3.5 rounded-[22px] p-[18px]">
            <div className="flex items-start gap-3.5">
              <div className="grid size-12 flex-none place-items-center rounded-2xl bg-[#ffe7d4]">
                <PathIcon
                  d="M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"
                  stroke="#f26a1b"
                  size={22}
                />
              </div>
              <div>
                <div className="text-base font-bold">{t('detail.needHelp')}</div>
                <div className="mt-1 text-[13px] leading-[1.55] text-stone-500">
                  {t('detail.contactUs')}
                </div>
              </div>
            </div>
            <Link
              to="/contact"
              className="flex h-[46px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-[#fdba8c] bg-white/70 text-[15px] font-semibold text-brand hover:bg-brand-soft"
            >
              {t('detail.sendMessage')}
            </Link>
          </div>
        </aside>
      </div>

      <section ref={reviewsRef} className="mx-auto max-w-[1400px] scroll-mt-24 px-4 pt-10 pb-16 md:px-10">
        <ReviewsSection
          courseId={id}
          viewerEnrolled={!!course.viewerEnrolled}
          viewerRole={course.viewerRole}
          fallbackRating={course.rating}
          fallbackCount={course.ratingCount}
        />
      </section>

      <Footer />
      <ToastHost />

      {showRequestDialog && (
        <JoinRequestDialog
          courseId={id}
          courseTitle={course.title}
          questions={course.joinQuestions}
          rules={course.rules}
          requireRules={course.requireRulesAgreement}
          onClose={() => setShowRequestDialog(false)}
          onSent={(req) => {
            savePendingRequestId(id, req.id);
            setPendingRequest(req.id);
            toast(t('detail.requestSent'));
          }}
        />
      )}

      {showPaidDialog && (
        <JoinDialog
          course={course}
          onClose={() => setShowPaidDialog(false)}
          onDone={() => {
            setShowPaidDialog(false);
            navigate(`/communities/${id}/community`);
          }}
          onNeedRequest={() => {
            setShowPaidDialog(false);
            if (pendingRequest === null) setShowRequestDialog(true);
          }}
        />
      )}
    </div>
  );
}

function OverviewTab({ course, priceLabel }: { course: CommunityDetail; priceLabel: string }) {
  const { t } = useTranslation('course');
  return (
    <div className="flex flex-col gap-[22px]">
      <section className="glass flex flex-col gap-4 rounded-[26px] p-6">
        <SectionTitle>{t('detail.aboutCourse')}</SectionTitle>
        <p className="m-0 text-[15px] leading-[1.75] text-stone-600 text-pretty">{course.about}</p>
        {course.highlights.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3">
            {course.highlights.map((h) => (
              <HighlightCard key={h.title} item={h} />
            ))}
          </div>
        )}
      </section>

      {course.gains.length > 0 && (
      <section className="glass flex flex-col gap-4.5 rounded-[26px] p-6">
        <SectionTitle>{t('detail.whatYouGet')}</SectionTitle>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-x-7 gap-y-5">
          {course.gains.map((g) => (
            <div key={g.title} className="flex items-center gap-3.5">
              <div className="glass-chip grid size-12 flex-none place-items-center rounded-2xl">
                <PathIcon d={g.icon} stroke="#f26a1b" size={22} />
              </div>
              <div>
                <div className="text-[15px] font-bold">{g.title}</div>
                <div className="mt-0.5 text-sm text-stone-500">{g.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      <section className="glass flex flex-col gap-4.5 rounded-[26px] p-6">
        <SectionTitle>{t('detail.cost')}</SectionTitle>
        <div className="flex flex-wrap items-center gap-x-10 gap-y-6 rounded-[22px] border border-white/95 bg-[linear-gradient(135deg,rgba(255,237,222,.85),rgba(255,247,240,.7))] p-6 shadow-[0_12px_30px_rgba(242,106,27,.08)]">
          <div className="flex flex-1 basis-[240px] items-center gap-5">
            <div className="grid size-[68px] flex-none place-items-center rounded-[18px] bg-white shadow-[0_8px_20px_rgba(242,106,27,.14)]">
              <PathIcon d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1zM4 7l11-3v3M16 13.5h.01" stroke="#f26a1b" size={32} />
            </div>
            <div className="text-[40px] font-extrabold tracking-[-1px] whitespace-nowrap">
              {priceLabel} {course.priceUsd > 0 && <span className="text-[26px] font-semibold tracking-normal">{t('detail.perMonthSpaced')}</span>}
            </div>
          </div>
          {course.priceNotes.length > 0 && <div className="hidden w-px self-stretch bg-[rgba(242,106,27,.2)] sm:block" />}
          <div className="flex flex-1 basis-[260px] flex-col gap-2.5">
            {course.priceNotes.map((p) => (
              <div key={p} className="flex items-center gap-2.5 text-[15px] text-stone-800">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f26a1b" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                  <path d="M5 12l5 5 9-10" />
                </svg>
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function HighlightCard({ item }: { item: CourseHighlight }) {
  return (
    <div className="glass flex items-start gap-3.5 rounded-[20px] p-4.5">
      <div className="grid size-12 flex-none place-items-center rounded-2xl bg-[#ffe7d4]">
        <PathIcon d={item.icon} stroke="#f26a1b" size={24} />
      </div>
      <div>
        <div className="text-[15px] leading-[1.35] font-bold">{item.title}</div>
        <div className="mt-1.5 text-[13px] leading-[1.55] text-stone-500">{item.desc}</div>
      </div>
    </div>
  );
}

function ContentTab({ courseId, enrolled, lessons }: { courseId: string; enrolled: boolean; lessons: number }) {
  const { t } = useTranslation('course');
  // Module/bài học thật nằm trong Lớp học của cộng đồng (chỉ thành viên xem được), không có bản "xem trước" bịa ở đây.
  return (
    <section className="glass flex flex-col items-center gap-3 rounded-3xl p-8 text-center">
      <p className="m-0 text-[15px] text-stone-700">
        {lessons > 0
          ? t('detail.contentSome', { n: lessons })
          : t('detail.contentNone')}
      </p>
      {enrolled && (
        <Link to={`/communities/${courseId}/community/lop-hoc`} className="text-sm font-semibold text-brand hover:underline">
          {t('detail.openClassroom')}
        </Link>
      )}
    </section>
  );
}

function FaqTab({ faqs }: { faqs: CourseFaq[] }) {
  return (
    <section className="flex flex-col gap-2.5">
      {faqs.map((f) => (
        <div key={f.question} className="glass rounded-[18px] p-4 px-5">
          <div className="text-[15px] font-bold">{f.question}</div>
          <div className="mt-1.5 text-sm leading-[1.6] text-stone-600">{f.answer}</div>
        </div>
      ))}
    </section>
  );
}
