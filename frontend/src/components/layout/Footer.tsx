import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { subscribeNewsletter } from '../../features/support/api';
import { Button } from '../ui/Button';
import { PathIcon } from '../ui/icons';

const COLUMNS: { title: string; links: { label: string; to?: string }[] }[] = [
  {
    title: 'Khám phá',
    links: [{ label: 'Khóa học' }, { label: 'Cộng đồng' }, { label: 'Sự kiện' }, { label: 'Chuyên gia' }],
  },
  {
    title: 'Hỗ trợ',
    links: [
      { label: 'Trung tâm trợ giúp' },
      { label: 'Liên hệ', to: '/contact' },
      { label: 'Câu hỏi thường gặp', to: '/faq' },
      { label: 'Về chúng tôi' },
    ],
  },
];

const SOCIALS = [
  { name: 'Facebook', d: 'M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v6h4v-6h3l1-4h-4V8z' },
  {
    name: 'YouTube',
    d: 'M3 8.5A3.5 3.5 0 0 1 6.5 5h11A3.5 3.5 0 0 1 21 8.5v7a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 15.5zM10 9.5v5l4.5-2.5z',
  },
  { name: 'TikTok', d: 'M14 3v11a3.5 3.5 0 1 1-3.5-3.5M14 3c.5 2.5 2.5 4.5 5 4.5' },
  { name: 'LinkedIn', d: 'M4 4h16v16H4zM8 10v6M8 7.5v.01M12 16v-6M12 13a2.5 2.5 0 0 1 5 0v3' },
];

const LEGAL = [
  { label: 'Điều khoản sử dụng', to: '/terms' },
  { label: 'Chính sách bảo mật', to: '/privacy' },
  { label: 'Cookie', to: '/privacy' },
];

export function Footer() {
  const [subscribed, setSubscribed] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  const subscribe = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    setSubError(null);
    setSubscribed(false);
    try {
      await subscribeNewsletter(email.trim());
      setSubscribed(true);
      setEmail('');
    } catch (err) {
      setSubError(
        err instanceof ApiError && err.status === 429
          ? 'Bạn thao tác quá nhanh, vui lòng thử lại sau.'
          : err instanceof ApiError
            ? err.message
            : 'Không đăng ký được, vui lòng thử lại.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <footer>
      <div className="rounded-t-[32px] border border-b-0 border-white/90 bg-white/55 px-4 pt-[clamp(28px,4vw,56px)] pb-6 shadow-[0_-10px_40px_rgba(120,60,20,.08)] backdrop-blur-[24px] backdrop-saturate-[180%] md:px-[max(40px,calc((100%-1320px)/2))]">
        <div className="flex flex-wrap justify-between gap-x-12 gap-y-8">
          <div className="flex min-w-[min(100%,240px)] flex-[0_1_300px] flex-col gap-4">
            <img src="/images/logo.png" alt="SofinHub" className="h-10 w-auto self-start" />
            <p className="m-0 max-w-[300px] text-sm leading-[1.65] text-stone-600 text-pretty">
              Nền tảng học tập và xây dựng cộng đồng cho chuyên gia, creator và doanh nghiệp.
            </p>
            <div className="flex gap-2.5">
              {SOCIALS.map((s) => (
                <a
                  key={s.name}
                  href="#"
                  title={s.name}
                  aria-label={s.name}
                  className="grid size-10 place-items-center rounded-full border border-white/95 bg-white/70 shadow-[0_4px_12px_rgba(120,60,20,.08)] hover:bg-[#fff1e7]"
                >
                  <PathIcon d={s.d} size={18} stroke="#1c1917" strokeWidth={1.8} />
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="mb-4 text-[15px] font-bold">{col.title}</div>
              <div className="flex flex-col gap-3">
                {col.links.map((l) =>
                  l.to ? (
                    <Link key={l.label} to={l.to} className="text-sm text-stone-600 hover:text-brand">
                      {l.label}
                    </Link>
                  ) : (
                    <a key={l.label} href="#" className="text-sm text-stone-600 hover:text-brand">
                      {l.label}
                    </a>
                  ),
                )}
              </div>
            </div>
          ))}

          <div className="min-w-[min(100%,240px)] flex-[0_1_300px]">
            <div className="mb-2 text-[15px] font-bold">Nhận bản tin</div>
            <p className="mt-0 mb-3.5 text-sm leading-[1.6] text-stone-600">
              Khóa học mới và mẹo học tập, mỗi tuần một lần.
            </p>
            <form
              onSubmit={subscribe}
              className="shadow-chip flex gap-1.5 rounded-2xl border border-[rgba(120,60,20,.15)] bg-white p-[5px]"
            >
              <input
                type="email"
                required
                placeholder="Email của bạn"
                aria-label="Email của bạn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent px-2.5 text-sm outline-0 placeholder:text-stone-400"
              />
              <Button type="submit" variant="brand-chip" disabled={sending} className="h-10 rounded-xl px-4 text-sm font-semibold whitespace-nowrap">
                {sending ? 'Đang gửi…' : 'Đăng ký'}
              </Button>
            </form>
            {subError && (
              <div role="alert" className="mt-2.5 text-[13px] text-red-600">
                {subError}
              </div>
            )}
            {subscribed && (
              <div role="status" className="mt-2.5 text-[13px] text-[#15803d]">
                Cảm ơn bạn đã đăng ký!
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[rgba(120,60,20,.1)] pt-5 text-[13px] text-stone-500">
          <span>© 2026 SofinHub. Bảo lưu mọi quyền.</span>
          <div className="flex flex-wrap gap-6">
            {LEGAL.map((l) => (
              <Link key={l.label} to={l.to} className="text-stone-500 hover:text-brand">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
