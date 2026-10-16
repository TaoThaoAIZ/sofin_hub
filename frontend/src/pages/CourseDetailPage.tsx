import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import i18n from '../i18n';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { Button, ButtonLink } from '../components/ui/Button';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { PathIcon, StarIcon, UserIcon } from '../components/ui/icons';
import { useAuth } from '../features/auth/AuthContext';
import { MediaGallery } from '../features/courses/components/MediaGallery';
import { TAG_UI } from '../features/courses/constants';
import { courseKeys, useCategories, useCommunityDetail, useToggleEnrollment } from '../features/courses/queries';
import type { CommunityDetail, CourseFaq } from '../features/courses/types';
import { ApiError } from '../lib/api';
import { PAGE_X } from '../lib/layout';
import { formatCompact } from '../lib/format';
import { JoinDialog } from '../features/payments/components/JoinDialog';
import { JoinRequestDialog, loadPendingRequestId, savePendingRequestId } from '../features/communities/components/JoinRequestDialog';
import { errorText } from '../features/communities/components/Modal';
import { ReviewsSection } from '../features/communities/components/ReviewsSection';
import { useCancelJoinRequest } from '../features/communities/queries';
import { usePendingItems } from '../features/settings/communities/queries';
import { toast, ToastHost } from '../features/community/components/contentUi';
import { isAtLeast } from '../features/communities/types';
import { usePopup } from '../components/ui/usePopup';

import { formatCents } from '../lib/datetime';
import { useTools } from '../features/tools/queries';

// Icon cờ lê (lucide "wrench") cho ô "Công cụ hỗ trợ".
const WRENCH_ICON = 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z';
/** 4 lợi ích gói thành viên dưới nút "Tham gia" (Figma "Membership benefits"): icon Material + màu nhấn (nền = màu nhấn ở độ mờ .16). */
const MEMBERSHIP_PERKS = [
  { key: 'instant', icon: 'bolt', color: '#ff9a1f' },
  { key: 'anywhere', icon: 'desktop_windows', color: '#16a34a' },
  { key: 'updates', icon: 'sync', color: '#3b82f6' },
  { key: 'support', icon: 'chat_bubble', color: '#ef4466' },
] as const;
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

/** Mô tả hiển thị gọn (tối đa ~4 dòng); dài hơn thì có nút Xem thêm / Thu gọn. */
function ShortText({ text }: { text: string }) {
  const { t } = useTranslation('course');
  const [open, setOpen] = useState(false);
  const long = text.length > 220 || text.split('\n').length > 4;
  return (
    <div className="max-w-[1000px]">
      <p className={`m-0 text-[clamp(16px,1.11vw,20px)] leading-[1.6] text-[#57524e] text-pretty whitespace-pre-line break-words dark:text-[#bababa] ${long && !open ? 'line-clamp-4' : ''}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 border-0 bg-transparent p-0 text-sm font-semibold text-brand hover:underline">
          {open ? t('detail.showLess') : t('detail.showMore')}
        </button>
      )}
    </div>
  );
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
  const toolsCount = useTools().data?.tools.length;
  const qc = useQueryClient();
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

  // Trạng thái "chờ duyệt" lấy theo BE: đã được duyệt/từ chối/hủy thì không còn trong danh sách → bỏ nhãn chờ để người dùng thanh toán/tham gia tiếp.
  const serverPending = usePendingItems();
  useEffect(() => {
    if (!serverPending.data) return;
    const mine = serverPending.data.requests.find((r) => r.communityId === id);
    if (mine && pendingRequest === null) {
      savePendingRequestId(id, mine.id);
      setPendingRequest(mine.id);
    } else if (!mine && pendingRequest !== null) {
      savePendingRequestId(id, null);
      setPendingRequest(null);
      // Yêu cầu vừa được duyệt/từ chối: nạp lại chi tiết để nút "Tham gia" / quyền vào cộng đồng cập nhật theo.
      void qc.invalidateQueries({ queryKey: courseKeys.detail(id) });
    }
  }, [serverPending.data, pendingRequest, id, qc]);

  if (isPending) {
    return (
      <div className="min-h-screen">
        <Header active="courses" />
        <p className="py-24 text-center text-stone-500">{t('detail.loading')}</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen">
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
  const priceLabel = course.priceUsd === 0 ? t('detail.free') : formatCents(course.priceUsd);

  const scrollToReviews = () =>
    reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const approved = !!course.viewerApproved && !course.viewerEnrolled;
  // Đã được duyệt thì không còn là bước xin phép: đi tiếp luồng thanh toán như cộng đồng công khai.
  const isPrivate = course.visibility === 'private' && !approved;
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
    // Chưa tham gia + khóa học có phí: hỏi BE trước. Còn gói đã trả chưa hết kỳ (vd. vừa "rời") thì BE cho vào lại, không phải trả tiền;
    // không thì BE trả 402 PAYMENT_REQUIRED → onJoinError mở dialog chọn gói/thanh toán (flow skool.com).
    if (course.priceUsd > 0) {
      enroll.mutate(undefined, { onSuccess: () => navigate(`/communities/${id}/community`), onError: onJoinError });
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

  // Cụm nút tham gia/rời/chờ duyệt... dùng ở 2 nơi: thẻ gói bên phải (desktop) và ngay dưới mô tả (mobile, theo Figma).
  const joinControls = (
      <div className="flex flex-col gap-4">
        {isLocked && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-[13px] font-medium text-red-700">
            {t('detail.lockedBanner')}
          </p>
        )}
        {course.viewerEnrolled && !isLocked && (
          <ButtonLink to={`/communities/${id}/community`} className="h-[65px] gap-3 rounded-[20px] text-[22px] font-extrabold max-md:h-12 max-md:text-lg shadow-[0_6px_16px_rgba(246,107,24,0.13)]">
            {t('detail.enter')}
            <MaterialIcon name="arrow_forward" size={24} color="#fff" />
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
          className="h-[65px] gap-3 rounded-[20px] text-[22px] font-extrabold max-md:h-12 max-md:text-lg shadow-[0_6px_16px_rgba(246,107,24,0.13)]"
        >
          {course.viewerEnrolled
            ? t('detail.joined')
            : hasPendingRequest
              ? t('detail.requestPending')
              : approved
                ? t('detail.approvedPay')
              : isPrivate
                ? t('detail.requestJoin')
                : t('detail.joinNow')}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d={course.viewerEnrolled ? 'M5 12l5 5 9-10' : 'M5 12h14M13 6l6 6-6 6'} />
          </svg>
        </Button>
        )}
        {isPrivate && !course.viewerEnrolled && !hasPendingRequest && (
          <p className="m-0 text-center text-xs text-[#827b75] dark:text-[#bababa]">{t('detail.privateNote')}</p>
        )}
        {hasPendingRequest && (
          <div className="flex flex-col items-center gap-1.5 text-center text-[13px] text-[#57524e] dark:text-[#bababa]">
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
        {joinNotice && <p className="m-0 text-center text-sm text-red-600">{joinNotice}</p>}
        {isAtLeast(course.viewerRole, 'admin') && (
          <Link
            to={`/communities/${id}/community/cai-dat`}
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-brand/10 text-sm font-semibold text-brand hover:bg-brand/15"
          >
            <MaterialIcon name="settings" size={18} color="#ff570a" />
            {t('detail.settings')}
          </Link>
        )}
      </div>
  );

  // Thẻ "Cần hỗ trợ?": desktop nằm cuối cột phải; mobile (Figma) nằm trước khối đánh giá.
  const supportCard = (
  <div className="flex flex-col gap-3 rounded-[22px] bg-white pt-4 pr-[18px] pb-[17px] pl-[17px] shadow-[0_5px_32px_6px_rgba(121,81,54,0.05)] dark:bg-[rgba(63,63,63,.3)] dark:shadow-none">
    <div className="flex items-start gap-3">
      <div className="grid size-12 flex-none place-items-center rounded-xl bg-[#ffe7d6] dark:bg-[rgba(255,87,10,.16)]">
        <PathIcon
          d="M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"
          stroke="#ff570a"
          size={26}
        />
      </div>
      <div className="min-w-0 flex-1 pt-px">
        <div className="text-[22px] font-bold text-[#242321] dark:text-white">{t('detail.needHelp')}</div>
        <div className="mt-1 text-sm leading-5 text-[#8c8580] dark:text-[#bababa]">
          {t('detail.contactUs')}
        </div>
      </div>
    </div>
    <Link
      to="/contact"
      className="flex h-12 items-center justify-center rounded-[15px] border border-brand text-base font-bold text-brand hover:bg-brand-soft"
    >
      {t('detail.sendMessage')}
    </Link>
  </div>
  );

  return (
    <div className="min-h-screen">
      <Header active="courses" />

      <div className={`${PAGE_X} flex flex-wrap items-center gap-3 pt-6 text-[14px] leading-6 text-[#57524e] dark:text-[#bababa]`}>
        <Link to="/" className="grid place-items-center text-brand" aria-label={t('detail.homeAria')}>
          <PathIcon d="M12 3 3 10.5V21h6v-6h6v6h6V10.5z" fill="#ff570a" size={18} />
        </Link>
        <span>›</span>
        <Link to="/" className="text-inherit hover:text-brand">
          {categoryName}
        </Link>
        <span>›</span>
        <span className="font-medium text-[#201e1c] dark:text-white">{course.title}</span>
      </div>

      <div className={`${PAGE_X} flex flex-wrap items-start gap-6 pt-5`}>
        <main className="flex min-w-0 flex-[999_1_620px] flex-col gap-[30px]">
          <MediaGallery
            items={course.media ?? []}
            fallback={course.thumbnail}
            alt={course.title}
            overlay={
              tag && (
                <span
                  className="absolute top-3 left-3.5 flex h-[42px] items-center rounded-[24px] px-[18px] text-lg font-bold"
                  style={{ background: tag.bg, color: tag.fg }}
                >
                  {t(tag.labelKey)}
                </span>
              )
            }
          />

          <div className="flex flex-col gap-3">
            <h1 className="m-0 text-[clamp(30px,2.55vw,46px)] leading-[1.48] max-md:text-2xl max-md:leading-8 font-extrabold text-[#201d1b] dark:text-white">{course.title}</h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-lg text-[#57524e] dark:text-[#bababa]">
              <span className="flex items-center gap-3">
                <StarIcon size={22} />
                <span>
                  <b className="text-[#201d1b] dark:text-white">{course.rating}</b> <span className="text-[#827b75] dark:text-[#bababa]">({course.ratingCount})</span>
                </span>
              </span>
              <span className="flex items-center gap-2.5">
                <UserIcon size={22} />
                <Trans t={t} i18nKey="detail.by" values={{ name: course.instructor.name }} components={{ b: <b className="text-[#201d1b] dark:text-white" /> }} />
              </span>
            </div>
            <ShortText text={course.description} />
            <div className="md:hidden">{joinControls}</div>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-[15px]">
            {course.facts
              .map((f) => (f.label === 'Chi phí tham gia' ? { ...f, label: t('detail.toolsFact'), value: toolsCount === undefined ? '–' : String(toolsCount), icon: WRENCH_ICON } : f))
              .map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-3 rounded-[26px] bg-white p-[18px] shadow-[1px_6px_15px_rgba(121,81,54,0.08)] dark:bg-[rgba(63,63,63,.3)] dark:shadow-none"
              >
                <div className="grid size-[50px] flex-none place-items-center rounded-2xl" style={{ background: `color-mix(in srgb, ${f.fg} 16%, transparent)` }}>
                  <PathIcon d={f.icon} stroke={f.fg} size={24} />
                </div>
                <div className="min-w-0 leading-normal">
                  <div className="text-xl font-bold whitespace-nowrap text-[#201d1b] dark:text-white">{f.value}</div>
                  <div className="text-sm whitespace-nowrap text-[#827b75] dark:text-[#bababa]">{f.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto rounded-[20px] p-1.5">
            {TABS.filter((tb) => tb.key !== 'faq' || course.faqs.length > 0).map((tb) => {
              const isActive = tb.key === tab;
              return (
                <button
                  key={tb.key}
                  type="button"
                  onClick={() => (tb.key === 'reviews' ? scrollToReviews() : setTab(tb.key))}
                  className={`h-[42px] flex-none rounded-[18px] border-0 px-[22px] text-[15px] leading-[1.45] whitespace-nowrap ${
                    isActive
                      ? 'bg-[linear-gradient(180deg,#ff8b3d,#ff7825_80%,#ef5a08)] font-bold text-white shadow-[0_9px_20px_rgba(237,109,35,0.25)]'
                      : 'bg-transparent font-normal text-[#5c5855] hover:text-brand dark:text-[#bababa]'
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

          <div className="md:hidden">{supportCard}</div>

          <div ref={reviewsRef} className="scroll-mt-24">
            <ReviewsSection
              courseId={id}
              viewerEnrolled={!!course.viewerEnrolled}
              viewerRole={course.viewerRole}
              fallbackRating={course.rating}
              fallbackCount={course.ratingCount}
            />
          </div>
        </main>

        <aside className="sticky top-24 flex min-w-0 flex-1 basis-[340px] flex-col gap-5 max-lg:static max-lg:basis-full min-[1100px]:max-w-[401px]">
          <div className="max-md:hidden rounded-[32px] border border-white bg-gradient-to-r from-white to-[#fff9f3] p-[11px] shadow-[1px_6px_15px_rgba(121,81,54,0.08)] dark:border-white/10 dark:from-[rgba(63,63,63,.3)] dark:to-[rgba(63,63,63,.3)] dark:shadow-none">
            <div className="relative h-[200px] overflow-hidden rounded-3xl">
              <img src={course.thumbnail} alt="" className="size-full object-cover" />
            </div>
            <div className="flex flex-col p-3">
              <div className="flex items-end gap-1 whitespace-nowrap text-brand">
                <span className="text-[clamp(34px,2.3vw,42px)] leading-[1.48] font-extrabold">{course.priceUsd === 0 ? priceLabel : Math.round(course.priceUsd).toLocaleString('vi-VN')}</span>
                {course.priceUsd > 0 && (
                  <span className="pb-1.5 text-[23px] leading-[1.2] font-medium">
                    <span className="underline">đ</span>
                    {t('detail.perMonth')}
                  </span>
                )}
              </div>

              <div className="flex items-center py-5 text-center">
                {[
                  { v: formatCompact(course.stats.members), l: t('detail.members') },
                  { v: course.stats.online, l: t('detail.online') },
                  { v: course.stats.admins, l: t('detail.admins') },
                ].map((s, i) => (
                  <div key={s.l} className={`flex-1 ${i ? 'border-l border-[#f0e4dc] dark:border-white/10' : ''}`}>
                    <div className="text-[26px] leading-[1.4] font-bold text-[#201d1b] dark:text-white">{s.v}</div>
                    <div className="text-[15px] leading-normal text-[#827b75] dark:text-[#bababa]">{s.l}</div>
                  </div>
                ))}
              </div>

              {joinControls}
            </div>

            <div className="flex flex-col px-3">
              {MEMBERSHIP_PERKS.map((p, i) => (
                <div key={p.key} className={`flex h-[63px] items-center gap-[13px] ${i < MEMBERSHIP_PERKS.length - 1 ? 'border-b border-[#f0ece9] dark:border-white/10' : ''}`}>
                  <div className="grid size-10 flex-none place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${p.color} 16%, transparent)` }}>
                    <MaterialIcon name={p.icon} size={20} color={p.color} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base leading-6 font-bold text-[#201e1c] dark:text-white">{t(`detail.perks.${p.key}.title`)}</div>
                    <div className="truncate text-xs leading-4 text-[#89827d] dark:text-[#bababa]">{t(`detail.perks.${p.key}.desc`)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="max-md:hidden flex flex-col gap-4 rounded-[28px] border border-white bg-white p-[26px] shadow-[1px_6px_15px_rgba(121,81,54,0.08)] dark:border-white/10 dark:bg-[rgba(63,63,63,.3)] dark:shadow-none">
            <div className="text-[22px] leading-normal font-extrabold text-[#201d1b] dark:text-white">{t('detail.youGet')}</div>
            <div className="flex flex-col gap-3">
              {sidebarPerks(course).map((p) => (
                <div key={p} className="flex items-center gap-3.5 text-base leading-6 text-[#201d1b] dark:text-white">
                  <span className="grid size-[33px] flex-none place-items-center rounded-full bg-brand shadow-[0_6px_16px_rgba(246,107,24,0.13)]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5 9-10" />
                    </svg>
                  </span>
                  {p}
                </div>
              ))}
            </div>
          </div>

          <div className="max-md:hidden">{supportCard}</div>
        </aside>
      </div>

      <div className="h-[clamp(36px,4.4vw,80px)]" />
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

const CARD = 'rounded-[25px] bg-white p-6 shadow-[1px_6px_30px_2px_rgba(121,81,54,0.1)] dark:bg-[rgba(63,63,63,.3)] dark:shadow-none';
const CARD_TITLE = 'm-0 text-[22px] leading-[30px] font-bold text-[#201e1c] dark:text-white';

function OverviewTab({ course }: { course: CommunityDetail; priceLabel: string }) {
  const { t } = useTranslation('course');
  return (
    <div className="flex flex-col gap-5">
      <section className={`${CARD} flex flex-col gap-4`}>
        <h2 className={CARD_TITLE}>{t('detail.tabs.overview')}</h2>
        <p className="m-0 text-base leading-6 text-[#5c5855] text-pretty whitespace-pre-line break-words dark:text-[#bababa]">{course.about}</p>
        {course.highlights.length > 0 && (
          <div className="flex flex-col gap-[13px]">
            {course.highlights.map((h) => (
              <p key={h.title} className="m-0 text-base leading-6 text-[#5c5855] dark:text-[#bababa]">
                <b className="font-semibold text-[#201e1c] dark:text-white">{h.title}</b>
                {h.desc ? `: ${h.desc}` : ''}
              </p>
            ))}
          </div>
        )}
      </section>

      {course.gains.length > 0 && (
        <section className={`${CARD} flex flex-col gap-4`}>
          <h2 className={CARD_TITLE}>{t('detail.whatYouGet')}</h2>
          <div className="flex flex-col gap-[13px]">
            {course.gains.map((g) => (
              <div key={g.title} className="flex items-center gap-3 text-base leading-6 text-[#5c5855] dark:text-[#bababa]">
                <span className="grid size-[22px] flex-none place-items-center rounded-full bg-gradient-to-b from-[#4be582] to-[#00a53f] shadow-[0_3px_5px_rgba(0,166,67,0.19)]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                </span>
                <span>
                  {g.title}
                  {g.desc ? ` — ${g.desc}` : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ContentTab({ courseId, enrolled, lessons }: { courseId: string; enrolled: boolean; lessons: number }) {
  const { t } = useTranslation('course');
  // Module/bài học thật nằm trong Lớp học của cộng đồng (chỉ thành viên xem được), không có bản "xem trước" bịa ở đây.
  return (
    <section className={`${CARD} flex flex-col items-center gap-3 p-8 text-center`}>
      <p className="m-0 text-[15px] text-[#5c5855] dark:text-[#bababa]">
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
        <div key={f.question} className="rounded-[18px] bg-white px-5 py-4 shadow-[1px_6px_15px_rgba(121,81,54,0.08)] dark:bg-[rgba(63,63,63,.3)] dark:shadow-none">
          <div className="text-[15px] font-bold">{f.question}</div>
          <div className="mt-1.5 text-sm leading-[1.6] text-stone-600">{f.answer}</div>
        </div>
      ))}
    </section>
  );
}
