import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useAuth } from '../../auth/AuthContext';

/**
 * Tour hướng dẫn lần đầu vào bảng tin cộng đồng — CHỈ trên mobile (< md), theo thiết kế "Tour bảng tin cộng đồng".
 * Mỗi bước tô sáng một phần tử (tìm bằng `sel`) và hiện thẻ giải thích; bước nào không có phần tử trên màn hình (vd. thẻ khởi đầu đã hoàn thành,
 * chưa có bài viết) thì tự bỏ qua. "Bỏ qua"/"Bắt đầu thôi" lưu cờ theo tài khoản; "Để sau" chỉ hoãn tới lần vào sau.
 */

const STEPS = [
  { key: 'composer', sel: '[data-tour="composer"]', scroll: true },
  { key: 'checklist', sel: '[data-tour="onboarding"]', scroll: true },
  { key: 'topics', sel: '[data-tour="topics"]', scroll: true },
  { key: 'post', sel: '[id^="post-"]', scroll: true },
  { key: 'menu', sel: '[data-tour="menu"]', scroll: false },
  { key: 'search', sel: '[data-tour="search"]', scroll: false },
  { key: 'bell', sel: '[data-tour="bell"]', scroll: false },
] as const;
type StepKey = (typeof STEPS)[number]['key'];

const doneKey = (userId: string) => `sofinhub.feedTourDone.${userId}`;
const LATER_KEY = 'sofinhub.feedTourLater';
const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

/** Đọc/ghi storage có thể ném lỗi (chế độ riêng tư, chặn dữ liệu): coi như chưa lưu và tour vẫn chạy bình thường. */
function readFlag(store: Storage, key: string): boolean {
  try {
    return store.getItem(key) === '1';
  } catch {
    return false;
  }
}
function writeFlag(store: Storage, key: string) {
  try {
    store.setItem(key, '1');
  } catch {
    /* không lưu được cờ: tour có thể hiện lại ở lần sau, không ảnh hưởng chức năng */
  }
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;
const GAP = 14;

export function FeedTour({ ready, hasPendingComment }: { ready: boolean; hasPendingComment: boolean }) {
  const { t } = useTranslation('community');
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // navigate/location có thể đổi danh tính mỗi lần render: giữ trong ref để hẹn giờ mở tour không bị hủy liên tục.
  const navigateRef = useRef(navigate);
  const urlRef = useRef(location.pathname + location.search);
  useEffect(() => {
    navigateRef.current = navigate;
    urlRef.current = location.pathname + location.search;
  });
  const [phase, setPhase] = useState<'idle' | 'intro' | 'steps'>('idle');
  const [steps, setSteps] = useState<StepKey[]>([]);
  const [idx, setIdx] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [tipH, setTipH] = useState(0);
  const tipRef = useRef<HTMLElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const userId = user?.id;
  const replay = (location.state as { tour?: boolean } | null)?.tour === true;

  const available = useCallback(() => STEPS.filter((s) => document.querySelector(s.sel)).map((s) => s.key), []);

  // Tự mở lần đầu (hoặc khi người dùng chọn "Hướng dẫn sử dụng" trong menu) sau khi bảng tin đã tải xong.
  useEffect(() => {
    if (!ready || !userId || phase !== 'idle' || !isMobile()) return;
    if (!replay && (readFlag(localStorage, doneKey(userId)) || readFlag(sessionStorage, LATER_KEY))) return;
    const id = window.setTimeout(() => {
      const list = available();
      if (list.length === 0) return;
      setSteps(list);
      setIdx(0);
      setPhase('intro');
      if (replay) navigateRef.current(urlRef.current, { replace: true, state: null });
    }, 700);
    return () => window.clearTimeout(id);
  }, [ready, userId, phase, replay, available]);

  const close = useCallback(
    (save: boolean) => {
      if (userId) writeFlag(save ? localStorage : sessionStorage, save ? doneKey(userId) : LATER_KEY);
      setPhase('idle');
    },
    [userId],
  );

  // Khóa cuộn trang, Esc = "Để sau", tự đóng khi xoay/phóng to màn hình thành desktop.
  useEffect(() => {
    if (phase === 'idle') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(false);
    const mq = window.matchMedia('(max-width: 767px)');
    const onMq = () => !mq.matches && setPhase('idle');
    document.addEventListener('keydown', onKey);
    mq.addEventListener('change', onMq);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      mq.removeEventListener('change', onMq);
    };
  }, [phase, close]);

  const step = phase === 'steps' ? STEPS.find((s) => s.key === steps[idx]) : undefined;

  // Cuộn phần tử vào giữa rồi đo vị trí; đo lại sau khi cuộn mượt xong và khi đổi kích thước.
  useEffect(() => {
    if (!step) {
      setBox(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(step.sel);
      if (!el) return setBox(null);
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    document.querySelector(step.sel)?.scrollIntoView({ block: step.scroll ? 'center' : 'nearest' });
    measure();
    const timers = [window.setTimeout(measure, 120), window.setTimeout(measure, 450)];
    window.addEventListener('resize', measure);
    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener('resize', measure);
    };
  }, [step]);

  useLayoutEffect(() => {
    if (tipRef.current) setTipH(tipRef.current.offsetHeight);
  }, [phase, idx, box]);

  useEffect(() => {
    if (phase !== 'idle') nextRef.current?.focus({ preventScroll: true });
  }, [phase, idx]);

  if (phase === 'idle') return null;

  const total = steps.length;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tipW = Math.min(351, vw - 24);

  const go = (d: number) => {
    const n = idx + d;
    if (n < 0) return setPhase('intro');
    if (n >= total) return close(true);
    setIdx(n);
  };

  if (phase === 'intro') {
    return createPortal(
      <div className="fixed inset-0 z-[90] md:hidden">
        <div className="absolute inset-0 bg-[rgba(23,17,12,.7)]" />
        <section role="dialog" aria-modal="true" aria-labelledby="ft-intro" className="absolute bottom-4 left-3 box-border rounded-[22px] bg-white p-4 shadow-[0_0_0_1px_#efedeb,0_18px_48px_rgba(23,17,12,.3)] dark:bg-[#1f1b18]" style={{ width: tipW }}>
          <button type="button" onClick={() => close(false)} aria-label={t('tour.later')} className="absolute top-1 right-1 grid size-11 place-items-center text-stone-500">
            <MaterialIcon name="close" size={20} color="currentColor" />
          </button>
          <div className="flex gap-3 pr-8">
            <span aria-hidden className="grid size-11 flex-none place-items-center rounded-[14px] bg-[#fff1e8] text-[#c2410c]">
              <MaterialIcon name="forum" size={22} color="currentColor" />
            </span>
            <div>
              <h2 id="ft-intro" className="m-0 text-[16px] leading-[22px] font-extrabold">{t('tour.introTitle')}</h2>
              <p className="mt-1 mb-0 text-[13.5px] leading-5 text-stone-600">{t('tour.introBody', { count: total })}</p>
            </div>
          </div>
          <div className="mt-3.5 flex gap-2">
            <button type="button" onClick={() => close(false)} className="h-11 flex-1 rounded-full bg-[#f2f2f2] text-[14px] font-semibold text-[#4f4f4f]">
              {t('tour.later')}
            </button>
            <button ref={nextRef} type="button" onClick={() => setPhase('steps')} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#cf440c] text-[14px] font-bold text-white">
              {t('tour.start')} <MaterialIcon name="arrow_forward" size={16} color="#fff" />
            </button>
          </div>
        </section>
      </div>,
      document.body,
    );
  }

  const key = steps[idx]!;
  const last = idx === total - 1;
  // Khung sáng: cắt theo màn hình (bài viết cao hơn màn hình chỉ tô phần nhìn thấy).
  const hole = box && {
    top: Math.max(0, box.top - PAD),
    left: Math.max(0, box.left - PAD),
    width: Math.min(vw, box.left + box.width + PAD) - Math.max(0, box.left - PAD),
    height: Math.min(vh, box.top + box.height + PAD) - Math.max(0, box.top - PAD),
  };
  let tipTop = vh - tipH - 16;
  let arrow: 'top' | 'bottom' | null = null;
  let arrowLeft = tipW / 2;
  if (hole) {
    const below = hole.top + hole.height + GAP;
    const above = hole.top - GAP - tipH;
    if (below + tipH + 12 <= vh) {
      tipTop = below;
      arrow = 'top';
    } else if (above >= 12) {
      tipTop = above;
      arrow = 'bottom';
    }
    arrowLeft = Math.min(tipW - 34, Math.max(20, hole.left + hole.width / 2 - 12));
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] md:hidden">
      {/* Lớp chặn thao tác bên dưới (chạm vào vùng tối không đóng tour, tránh bấm nhầm). */}
      <div className="absolute inset-0" />
      {hole ? (
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            ...hole,
            borderRadius: hole.height <= 56 ? 9999 : 24,
            boxShadow: '0 0 0 2px #ff570a, 0 0 0 8px rgba(255,87,10,.22), 0 0 0 2000px rgba(23,17,12,.7)',
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[rgba(23,17,12,.7)]" />
      )}
      <section
        ref={tipRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ft-title"
        className="absolute left-3 box-border rounded-[18px] bg-white px-[18px] py-4 shadow-[0_16px_40px_rgba(0,0,0,.3)] dark:bg-[#1f1b18]"
        style={{ width: tipW, top: tipTop }}
      >
        {arrow && (
          <span
            aria-hidden
            className="absolute size-3.5 rotate-45 rounded-[2px] bg-white dark:bg-[#1f1b18]"
            style={{ left: arrowLeft, [arrow === 'top' ? 'top' : 'bottom']: -6 }}
          />
        )}
        <div className="relative flex items-center justify-between">
          <span className="text-[12px] font-extrabold tracking-[.06em] text-[#c2410c]">{t('tour.stepOf', { n: idx + 1, total })}</span>
          <button type="button" onClick={() => close(true)} className="-my-3 -mr-2.5 inline-flex h-11 items-center px-2.5 text-[13px] font-semibold text-stone-500">
            {t('tour.skip')}
          </button>
        </div>
        <h2 id="ft-title" className="relative mt-1.5 mb-0 text-[18px] leading-6 font-extrabold">{t(`tour.steps.${key}.title`)}</h2>
        {key !== 'post' && <p className="relative mt-1.5 mb-0 text-[14px] leading-[21px] text-stone-600">{t(`tour.steps.${key}.body`)}</p>}
        {key === 'post' && (
          <ul className="relative mt-2.5 mb-0 flex list-none flex-col gap-1.5 p-0 text-[14px] leading-5">
            {(['like', 'comment', 'share'] as const).map((k, i) => (
              <li key={k} className="flex items-center gap-2.5">
                <span aria-hidden className="grid size-5 flex-none place-items-center rounded-full bg-[#cf440c] text-[11px] font-extrabold text-white">{i + 1}</span>
                <span>{t(`tour.post.${k}`)}</span>
              </li>
            ))}
          </ul>
        )}
        {key === 'checklist' && steps.includes('post') && <p className="relative mt-2.5 mb-0 rounded-xl bg-[#fff4ec] px-2.5 py-2 text-[13px] leading-[19px] text-[#6b4a36]">{t('tour.checklistNote')}</p>}
        {key === 'post' && hasPendingComment && steps.includes('checklist') && (
          <p className="relative mt-3 mb-0 flex items-center gap-2 rounded-xl bg-[#fff4ec] px-2.5 py-2 text-[13px] leading-[19px] text-[#6b4a36]">
            <MaterialIcon name="check" size={16} color="#c2410c" /> {t('tour.postNote')}
          </p>
        )}
        <div className="relative mt-4 flex items-center justify-between">
          <div role="img" aria-label={t('tour.stepOf', { n: idx + 1, total })} className="flex items-center gap-1">
            {steps.map((k, i) => (
              <span key={k} className={`h-[5px] rounded-[3px] ${i === idx ? 'w-3.5 bg-[#ff570a]' : i < idx ? 'w-[5px] bg-[#ffc7a8]' : 'w-[5px] bg-[#e2dfdc]'}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => go(-1)} className="h-11 rounded-full bg-[#f2f2f2] px-3.5 text-[14px] font-semibold text-[#4f4f4f]">
              {t('tour.back')}
            </button>
            <button ref={nextRef} type="button" onClick={() => go(1)} className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#cf440c] px-[18px] text-[14px] font-bold text-white">
              {last ? t('tour.finish') : t('tour.next')}
              {!last && <MaterialIcon name="arrow_forward" size={16} color="#fff" />}
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
