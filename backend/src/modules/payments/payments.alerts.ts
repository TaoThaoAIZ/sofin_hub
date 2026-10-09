import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { notify } from '../notifications/notifications.service.js';
import type { PaymentIntent } from './payments.types.js';

/**
 * Báo tin về tiền cho người vận hành. Mọi hàm ở đây KHÔNG BAO GIỜ ném lỗi (báo tin hỏng không được làm hỏng việc cấp quyền/khớp tiền):
 *  - Thông báo trong app (chuông) cho admin: Super Admin (env PLATFORM_ADMIN_EMAILS) + nhân viên active có quyền `payment.view`/`payment.manage`.
 *  - Telegram (tùy chọn): đặt TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (nhiều chat ngăn cách dấu phẩy). Thiếu = tắt, không lỗi.
 *  - Owner cộng đồng được báo khi có người trả tiền vào cộng đồng của họ.
 */

const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chats = (process.env.TELEGRAM_CHAT_ID ?? '').split(',').map((c) => c.trim()).filter(Boolean);
  if (!token || !chats.length) return false;
  const results = await Promise.allSettled(
    chats.map((chat_id) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true }),
        signal: AbortSignal.timeout(8_000),
      }).then((r) => {
        if (!r.ok) throw new Error(`telegram ${r.status}`);
      }),
    ),
  );
  return results.some((r) => r.status === 'fulfilled');
}

/** Id các admin cần nhận tin tiền: Super Admin (env) + nhân viên active có quyền xem/quản lý thanh toán. */
export async function paymentAdminIds(): Promise<string[]> {
  const [supers, staff] = await Promise.all([
    prisma.user.findMany({ where: { email: { in: env.PLATFORM_ADMIN_EMAILS } }, select: { id: true } }),
    prisma.adminAccount.findMany({
      where: { status: 'active', OR: [{ roleKey: 'super_admin' }, { role: { permissions: { hasSome: ['payment.view', 'payment.manage'] } } }] },
      select: { userId: true },
    }),
  ]);
  return [...new Set([...supers.map((u) => u.id), ...staff.map((s) => s.userId)])];
}

async function tellAdmins(title: string, body: string, link: string, communityId?: string) {
  for (const userId of await paymentAdminIds()) notify({ userId, type: 'system', title, body, link, communityId });
}

/** Tiền cần người xử lý (thiếu/dư/trùng/hết hạn/chưa cấp được...). */
export async function alertMoneyIssue(message: string): Promise<void> {
  console.error(`[ALERT][payments] ${message}`);
  try {
    await Promise.allSettled([tellAdmins('Cần xử lý tiền chuyển khoản', message, '/admin/payments/bank'), sendTelegram(`⚠️ <b>CẦN XỬ LÝ TIỀN CHUYỂN KHOẢN</b>\n${esc(message)}`)]);
  } catch (err) {
    console.error('[payments] alertMoneyIssue lỗi:', err);
  }
}

const KIND_LABEL: Record<PaymentIntent['kind'], string> = { initial: 'Gói thành viên', renewal: 'Gia hạn gói', module: 'Mua module' };

/** Có thanh toán thành công (đã commit): báo admin (chuông + Telegram) và owner cộng đồng. */
export async function announcePaid(p: PaymentIntent): Promise<void> {
  try {
    const [community, buyer] = await Promise.all([
      prisma.community.findUnique({ where: { id: p.communityId }, select: { title: true, ownerId: true } }),
      prisma.user.findUnique({ where: { id: p.userId }, select: { firstName: true, lastName: true, email: true } }),
    ]);
    const who = buyer ? `${`${buyer.firstName} ${buyer.lastName}`.trim()} (${buyer.email})` : p.userId;
    const what = `${KIND_LABEL[p.kind]} · ${community?.title ?? p.communityId}`;
    const via = p.gatewayChargeId?.startsWith('manual:') ? 'admin duyệt tay' : 'chuyển khoản';
    const body = `${who} đã thanh toán ${vnd(p.amountCents)} — ${what} (${via}, mã ${p.refCode ?? '-'}${p.invoiceNumber ? `, HĐ ${p.invoiceNumber}` : ''}).`;
    await Promise.allSettled([
      tellAdmins(`Thanh toán mới: ${vnd(p.amountCents)}`, body, `/admin/payments/tx/${p.id}`, p.communityId),
      sendTelegram(`💰 <b>THANH TOÁN MỚI ${esc(vnd(p.amountCents))}</b>\n👤 ${esc(who)}\n📦 ${esc(what)}\n🏦 ${esc(via)} · mã ${esc(p.refCode ?? '-')}${p.invoiceNumber ? `\n🧾 ${esc(p.invoiceNumber)}` : ''}`),
    ]);
    if (community?.ownerId && community.ownerId !== p.userId) {
      notify({
        userId: community.ownerId,
        type: 'payment_succeeded',
        title: p.kind === 'renewal' ? 'Một thành viên đã gia hạn' : p.kind === 'module' ? 'Có người mua module' : 'Có thành viên mới thanh toán',
        body: `${buyer ? `${buyer.firstName} ${buyer.lastName}`.trim() : 'Một thành viên'} đã thanh toán ${vnd(p.amountCents)} — ${what}.`,
        link: `/courses/${p.communityId}/revenue`,
        communityId: p.communityId,
      });
    }
  } catch (err) {
    console.error('[payments] announcePaid lỗi:', err);
  }
}
