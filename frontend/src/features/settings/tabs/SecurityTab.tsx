import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError } from '../../../lib/api';
import { useRevokeSession, useSessions } from '../../account/queries';
import { useToast } from '../../admin/components/overlay';
import { sendVerification } from '../../auth/api';
import { useAuth } from '../../auth/AuthContext';
import { Badge } from '../ui';
import {
  blockersSentence,
  deviceView,
  LANGUAGE_OPTIONS,
  passwordSubtitle,
  sortDevices,
  TIMEZONE_OPTIONS,
} from '../security/format';
import { DeleteModal, EmailModal, PasswordModal, TwoFactorModal } from '../security/Modals';
import { useDeleteBlockers, useRevokeOthers, useUpdatePreferences } from '../security/queries';

const CARD = 'min-w-0 rounded-[20px] border border-[rgba(120,60,20,.07)] bg-white px-6 py-[22px]';
const ROW_BTN = 'h-[46px] whitespace-nowrap rounded-xl border-[1.5px] border-[#e7e0da] bg-white px-5 text-sm font-bold hover:border-[#fdba74] disabled:opacity-50';
const SELECT = 'min-w-0 flex-1 cursor-pointer border-0 bg-transparent text-[15px] font-medium outline-0';
const THEMES = [
  { id: 'light', label: 'Sáng', icon: 'light_mode', color: '#f26a1b' },
  { id: 'dark', label: 'Tối', icon: 'dark_mode', color: '#1e3a8a' },
  { id: 'system', label: 'Theo hệ thống', icon: 'desktop_windows', color: '#1c1917' },
] as const;

function CardHead({ icon, title, sub, className = '', action }: { icon: string; title: string; sub: string; className?: string; action?: ReactNode }) {
  return (
    <div className={`flex flex-wrap items-start gap-3.5 ${className}`}>
      <span className="grid size-11 flex-none place-items-center rounded-full bg-[#fff1e6]">
        <MaterialIcon name={icon} size={22} filled color="#f26a1b" />
      </span>
      <div className="min-w-[200px] flex-1">
        <div className="text-[19px] font-extrabold">{title}</div>
        <div className="mt-[3px] text-[13.5px] text-stone-500">{sub}</div>
      </div>
      {action}
    </div>
  );
}

function Row({ icon, title, children, action }: { icon: string; title: string; children: ReactNode; action: ReactNode }) {
  return (
    <div className="flex items-center gap-4 border-t border-[#f1ebe6] py-[18px]">
      <span className="grid size-11 flex-none place-items-center rounded-xl bg-[#f7f4f1]">
        <MaterialIcon name={icon} size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15.5px] font-bold">{title}</div>
        {children}
      </div>
      {action}
    </div>
  );
}

type ModalKind = 'email' | 'pw' | '2fa' | 'delete' | null;

/** Tab "Tài khoản & bảo mật" (thiết kế "Cai dat ho so"): đăng nhập, thiết bị | ngôn ngữ, giao diện, xóa tài khoản. */
export function SecurityTab() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [modal, setModal] = useState<ModalKind>(null);
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOthers();
  const prefs = useUpdatePreferences();
  const blockers = useDeleteBlockers();
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);

  // Liên kết ở sidebar "Bảo vệ tài khoản" (?2fa=1): mở modal bật 2FA (đang bật rồi thì chỉ báo).
  const want2fa = params.get('2fa') === '1';
  const enabled = user?.twoFactorEnabled ?? false;
  useEffect(() => {
    if (!want2fa || !user) return;
    if (user.twoFactorEnabled) toast.success('Xác minh 2 bước đang bật');
    else setModal('2fa');
    setParams(
      (p) => {
        p.delete('2fa');
        return p;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ phản ứng khi tham số ?2fa xuất hiện
  }, [want2fa, !!user]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  if (!user) return <main className="min-w-0" />;

  const devices = sortDevices(sessions.data ?? []).map((s) => deviceView(s));
  const hasOthers = devices.length > 1;
  const blockedText = blockersSentence(blockers.data);
  const target = user.pendingEmail ?? user.email;
  const needsVerify = !!user.pendingEmail || !user.emailVerified;

  // Gửi (lại) link xác minh: tới email MỚI nếu đang chờ đổi email, ngược lại tới email hiện tại. BE giới hạn 1 lần/60 giây.
  const resend = async () => {
    setSending(true);
    try {
      await sendVerification();
      setCooldown(60);
      toast.success(`Đã gửi email xác minh tới ${target}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setCooldown(60);
        toast.error('Bạn vừa yêu cầu gửi email, vui lòng đợi rồi thử lại');
      } else if (e instanceof ApiError && e.status === 409) {
        updateUser({ ...user, emailVerified: true });
      } else toast.error(e instanceof ApiError ? e.message : 'Không gửi được email xác minh');
    } finally {
      setSending(false);
    }
  };

  const savePref = (patch: Parameters<typeof prefs.mutate>[0], msg: string) =>
    prefs.mutate(patch, { onSuccess: () => toast.success(msg), onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Không lưu được tùy chọn') });

  const tzKnown = TIMEZONE_OPTIONS.some((o) => o.value === user.timezone);

  return (
    <main className="grid min-w-0 items-start gap-[18px] grid-cols-1 min-[1180px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className={CARD}>
          <CardHead icon="lock" title="Đăng nhập" sub="Quản lý thông tin đăng nhập và bảo mật tài khoản." className="mb-3.5" />
          <Row
            icon="mail"
            title="Email"
            action={
              <button type="button" onClick={() => setModal('email')} className={ROW_BTN}>
                Đổi email
              </button>
            }
          >
            <div className="mt-[3px] flex flex-wrap items-center gap-2.5 text-sm break-all text-stone-600">
              {user.email}
              <Badge tone={user.emailVerified ? 'green' : 'amber'}>{user.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'}</Badge>
            </div>
            {needsVerify && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 text-[13px] text-stone-600">
                {user.pendingEmail ? (
                  <span>
                    Đang chờ xác nhận <b className="break-all">{user.pendingEmail}</b> — kiểm tra hộp thư của email mới.
                  </span>
                ) : (
                  <span>Email chưa xác minh.</span>
                )}
                <button
                  type="button"
                  onClick={resend}
                  disabled={sending || cooldown > 0}
                  className="border-0 bg-transparent p-0 text-[13px] font-semibold text-brand underline disabled:no-underline disabled:opacity-60"
                >
                  {sending ? 'Đang gửi…' : cooldown > 0 ? `Gửi lại sau ${cooldown}s` : user.pendingEmail ? 'Gửi lại email xác nhận' : 'Gửi email xác minh'}
                </button>
              </div>
            )}
          </Row>
          <Row
            icon="lock"
            title="Mật khẩu"
            action={
              <button type="button" onClick={() => setModal('pw')} className={ROW_BTN}>
                Đổi mật khẩu
              </button>
            }
          >
            <div className="mt-[3px] text-sm text-stone-600">{passwordSubtitle(user.passwordChangedAt)}</div>
          </Row>
          <Row
            icon="shield"
            title="Xác minh 2 bước"
            action={
              <div className="flex flex-col items-end gap-2.5">
                <span className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] font-semibold ${enabled ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fef3c7] text-[#b45309]'}`}>
                  <MaterialIcon name={enabled ? 'check_circle' : 'error'} size={16} filled />
                  {enabled ? 'Đang bật' : 'Đang tắt'}
                </span>
                <button type="button" onClick={() => setModal('2fa')} className={ROW_BTN}>
                  {enabled ? 'Quản lý' : 'Bật ngay'}
                </button>
              </div>
            }
          >
            <div className="mt-[3px] text-sm leading-normal text-stone-600">Thêm một lớp bảo mật để bảo vệ tài khoản của bạn khỏi truy cập trái phép.</div>
          </Row>
        </section>

        <section className={CARD}>
          <CardHead
            icon="devices"
            title="Thiết bị đang đăng nhập"
            sub="Quản lý các thiết bị đã đăng nhập vào tài khoản của bạn."
            className="mb-4"
            action={
              hasOthers && (
                <button
                  type="button"
                  disabled={revokeOthers.isPending}
                  onClick={() =>
                    revokeOthers.mutate(undefined, {
                      onSuccess: () => toast.success('Đã đăng xuất mọi thiết bị khác'),
                      onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Không đăng xuất được'),
                    })
                  }
                  className="flex h-10 items-center gap-1.5 rounded-xl border-[1.5px] border-[#fca5a5] bg-white px-3.5 text-[13.5px] font-bold text-[#dc2626] disabled:opacity-50"
                >
                  <MaterialIcon name="logout" size={19} />
                  Đăng xuất mọi thiết bị
                </button>
              )
            }
          />
          <div className="flex flex-col gap-3">
            {sessions.isPending && <div className="text-sm text-stone-500">Đang tải danh sách thiết bị…</div>}
            {sessions.isError && (
              <div className="text-sm text-[#b91c1c]">
                Không tải được danh sách thiết bị.{' '}
                <button type="button" onClick={() => sessions.refetch()} className="border-0 bg-transparent p-0 font-semibold underline">
                  Thử lại
                </button>
              </div>
            )}
            {devices.map((d) => (
              <div key={d.id} className="flex gap-4 rounded-2xl border border-[#f0ebe6] p-4">
                <span className="grid size-12 flex-none place-items-center rounded-xl bg-[#f7f4f1]">
                  <MaterialIcon name={d.icon} size={24} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[15.5px] font-bold">{d.name}</span>
                    {d.current && <Badge tone="green">Thiết bị này</Badge>}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[13.5px] text-stone-600">
                    <MaterialIcon name="check_circle" size={17} filled color="#16a34a" />
                    {d.where}
                  </div>
                  <div className="mt-1 text-[13.5px] text-stone-500">{d.meta}</div>
                </div>
                {!d.current && (
                  <button
                    type="button"
                    disabled={revoke.isPending}
                    onClick={() =>
                      revoke.mutate(d.id, {
                        onSuccess: () => toast.success(`Đã đăng xuất ${d.name}`),
                        onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Không đăng xuất được'),
                      })
                    }
                    className="self-start border-0 bg-transparent p-0 text-sm font-semibold text-brand underline disabled:opacity-50"
                  >
                    Đăng xuất
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className={CARD}>
          <CardHead icon="language" title="Ngôn ngữ & khu vực" sub="Tùy chỉnh ngôn ngữ hiển thị và múi giờ của bạn." className="mb-[18px]" />
          <div className="mb-2 text-[14.5px] font-bold">Ngôn ngữ</div>
          <div className="flex h-[52px] items-center gap-3 rounded-xl border-[1.5px] border-[#e7e0da] px-3.5">
            <MaterialIcon name="flag" size={20} filled color="#dc2626" />
            <select
              aria-label="Ngôn ngữ"
              value={user.language}
              onChange={(e) => savePref({ language: e.target.value as 'vi' | 'en' }, 'Đã lưu ngôn ngữ')}
              className={SELECT}
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 mb-2 text-[14.5px] font-bold">Múi giờ</div>
          <div className="flex h-[52px] items-center gap-3 rounded-xl border-[1.5px] border-[#e7e0da] px-3.5">
            <MaterialIcon name="schedule" size={21} />
            <select aria-label="Múi giờ" value={user.timezone} onChange={(e) => savePref({ timezone: e.target.value }, 'Đã lưu múi giờ')} className={SELECT}>
              {!tzKnown && <option value={user.timezone}>{user.timezone}</option>}
              {TIMEZONE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className={CARD}>
          <CardHead icon="palette" title="Giao diện" sub="Chọn giao diện hiển thị phù hợp với sở thích của bạn." className="mb-[18px]" />
          <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Giao diện">
            {THEMES.map((t) => {
              const on = user.theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => savePref({ theme: t.id }, 'Đã lưu giao diện')}
                  className={`flex cursor-pointer flex-col items-center gap-2.5 rounded-[14px] px-2 py-[18px] text-center text-sm font-semibold ${
                    on ? 'border-2 border-brand bg-[#fff7f1]' : 'border-[1.5px] border-[#ece5df] bg-white'
                  }`}
                >
                  <span className="grid size-[42px] place-items-center rounded-xl bg-[#f7f4f1]">
                    <MaterialIcon name={t.icon} size={22} filled color={t.color} />
                  </span>
                  {t.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[20px] border border-[#fecaca] bg-[#fff5f5] px-6 py-[22px]">
          <div className="flex items-start gap-3.5">
            <span className="grid size-11 flex-none place-items-center rounded-full bg-[#fee2e2]">
              <MaterialIcon name="delete" size={22} filled color="#dc2626" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[19px] font-extrabold">Xóa tài khoản</div>
              <div className="mt-1.5 text-sm leading-[1.6] text-stone-600">
                {blockedText ?? 'Hồ sơ của bạn sẽ bị xóa vĩnh viễn và không thể khôi phục. Bài viết và bình luận cũ được giữ lại dưới tên “Thành viên đã xóa”.'}
              </div>
              <button
                type="button"
                onClick={() => setModal('delete')}
                className="mt-4 h-12 rounded-xl border-[1.5px] border-[#fca5a5] bg-white px-7 text-[15px] font-bold text-[#dc2626]"
              >
                Xóa tài khoản vĩnh viễn
              </button>
            </div>
          </div>
        </section>
      </div>

      {modal === 'email' && <EmailModal onClose={() => setModal(null)} />}
      {modal === 'pw' && (
        <PasswordModal
          onChanged={() => {
            updateUser({ ...user, passwordChangedAt: new Date().toISOString() });
            void sessions.refetch(); // các thiết bị khác bị đăng xuất khi đổi mật khẩu
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === '2fa' && <TwoFactorModal enabled={enabled} onClose={() => setModal(null)} />}
      {modal === 'delete' && <DeleteModal blockers={blockers.data} onClose={() => setModal(null)} />}
    </main>
  );
}
