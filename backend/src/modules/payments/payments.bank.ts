import { randomInt, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import type { NewBankTransaction, PaymentsRepository } from './payments.repository.js';
import type { PaymentIntent } from './payments.types.js';

/**
 * Đối soát chuyển khoản ngân hàng — port từ payment-engine (Python) / sofin (NestJS) sang SofinHub.
 *
 * BA đường vào, MỘT công thức cấp quyền (`deps.settle` = settle() của PaymentsService, idempotent theo trạng thái 'pending'):
 *   (A) webhook SePay realtime        — `handleWebhook`
 *   (B) cron tự quét API SePay        — `scanAndReconcile` (chạy được cả khi webhook không tới được server)
 *   (C) admin duyệt tay               — `approveManually`
 * Đường nào tới trước thì cấp; đường sau thấy payment không còn 'pending' nên lùi — không bao giờ cộng 2 lần.
 * Mọi giao dịch tiền VÀO đều được ghi vào BankTransaction (externalId UNIQUE) dù khớp hay không: tiền vào mà không có dấu vết
 * là cách nhanh nhất để mất tiền mà không ai biết.
 */

/** Phiên sống 15 phút (khớp payment-engine). Hóa đơn gia hạn có hạn riêng (tới hết kỳ ân hạn). */
export const SESSION_TTL_MS = 15 * 60_000;
/** Trần 1 giao dịch — quá là lỗi hoặc tấn công. */
export const MAX_SINGLE_AMOUNT = 50_000_000;

// Không có 0/O/1/I để khách gõ tay không nhầm.
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REF_BODY_LEN = 8;

const prefix = () => env.PAY_REF_PREFIX.toUpperCase();

export function makeRefCode(): string {
  let code = prefix();
  for (let i = 0; i < REF_BODY_LEN; i++) code += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return code;
}

/**
 * Rút mã từ các nguồn (code/nội dung CK). Dùng CHUNG cho webhook và quét — hai đường khớp khác nhau là mầm bug lệch tiền.
 * Thử khớp thẳng, rồi thử bản đã bỏ ký tự phân cách (ngân hàng đôi khi chèn dấu cách/gạch vào nội dung).
 */
export function extractRef(...sources: unknown[]): string {
  const pat = new RegExp(`${prefix()}[${REF_ALPHABET}]{${REF_BODY_LEN}}`);
  for (const src of sources) {
    const s = String(src ?? '').toUpperCase();
    const m = s.match(pat) ?? s.replace(/[^A-Z0-9]/g, '').match(pat);
    if (m) return m[0];
  }
  return '';
}

export interface TransferInfo {
  refCode: string;
  amount: number;
  /** Nội dung CK khách PHẢI ghi — FE nhúng vào QR. */
  transferContent: string;
  qrUrl: string;
  bankAccount: string;
  bankBin: string;
  bankName: string;
  accountName: string;
  expiresAt: string;
}

export function bankConfigured(): boolean {
  return !!env.BANK_ACCOUNT;
}

/** Thông tin để FE dựng QR + hướng dẫn chuyển khoản cho 1 payment đang chờ. */
export function transferInfoFor(p: Pick<PaymentIntent, 'refCode' | 'amountCents' | 'expiresAt'>): TransferInfo | undefined {
  if (!p.refCode) return undefined;
  const qs = `amount=${Math.round(p.amountCents)}&addInfo=${encodeURIComponent(p.refCode)}&accountName=${encodeURIComponent(env.BANK_ACCOUNT_NAME)}`;
  return {
    refCode: p.refCode,
    amount: p.amountCents,
    transferContent: p.refCode,
    qrUrl: `https://img.vietqr.io/image/${env.BANK_BIN}-${env.BANK_ACCOUNT}-compact2.png?${qs}`,
    bankAccount: env.BANK_ACCOUNT,
    bankBin: env.BANK_BIN,
    bankName: env.BANK_NAME,
    accountName: env.BANK_ACCOUNT_NAME,
    expiresAt: p.expiresAt ?? new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
}

// ------------------------------------------------------------------------------------------------ parse (SePay)
export interface ParsedTransfer {
  externalId: string;
  gateway?: string;
  accountNumber?: string;
  amount: number;
  description: string;
  ref: string;
  transactionDate: Date;
}

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));

/** "YYYY-MM-DD HH:mm:ss" của SePay là giờ VN (UTC+7) không kèm offset ⇒ ghim offset rõ ràng. */
function parseDate(v: unknown): Date {
  const s = str(v).trim();
  if (!s) return new Date();
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(' ', 'T')}+07:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Chấp nhận CẢ HAI hình dạng của SePay: webhook (camelCase: id/gateway/transferType/transferAmount/content/code/transactionDate)
 * và `GET /transactions/list` (snake_case: id/bank_brand_name/amount_in/transaction_content/code/transaction_date).
 * Trả null cho tiền RA hoặc dòng không dùng được.
 */
export function parseSepay(raw: Record<string, unknown>): ParsedTransfer | null {
  const externalId = str(raw.id ?? raw.transactionID ?? raw.transaction_id).trim();
  if (!externalId) return null;
  const type = str(raw.transferType).toLowerCase();
  if (type && type !== 'in') return null;
  const amountIn = raw.amount_in !== undefined ? Number(raw.amount_in) : undefined;
  if (amountIn !== undefined && !(amountIn > 0)) return null; // list: amount_in = 0 ⇒ tiền ra
  const amount = Math.round(amountIn ?? Number(raw.transferAmount ?? raw.amount ?? 0));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const description = str(raw.transaction_content ?? raw.content ?? raw.description ?? raw.transferContent);
  return {
    externalId,
    gateway: str(raw.bank_brand_name ?? raw.gateway ?? raw.bankBrandName) || undefined,
    accountNumber: str(raw.account_number ?? raw.accountNumber) || undefined,
    amount,
    description,
    ref: extractRef(raw.code, description, raw.description, raw.content),
    transactionDate: parseDate(raw.transaction_date ?? raw.transactionDate),
  };
}

/** Header SePay: `Authorization: Apikey <key>` (mặc định) hoặc `Bearer <key>`. So sánh timing-safe. */
export function webhookAuthorized(authHeader: string | undefined): boolean {
  const key = env.SEPAY_WEBHOOK_KEY;
  if (!key) return false; // chưa cấu hình = TỪ CHỐI HẾT. Mở toang webhook cộng tiền là tự sát.
  const m = /^(?:Apikey|Bearer)\s+(.+)$/i.exec((authHeader ?? '').trim());
  if (!m) return false;
  const a = Buffer.from(m[1]!);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ------------------------------------------------------------------------------------------------ reconciler
export type BankOutcome = 'credited' | 'already' | 'no_ref' | 'unmatched' | 'underpaid' | 'expired' | 'duplicate' | 'error';

export interface BankDeps {
  repo: PaymentsRepository;
  /** settle() của PaymentsService. `externalRef` ghi vào gatewayChargeId. */
  settle: (intent: PaymentIntent, externalRef: string) => Promise<PaymentIntent>;
  alert?: (msg: string) => void;
  http?: typeof fetch;
  /** Mặc định env.SEPAY_API_TOKEN (test truyền token giả để thử đường quét). */
  apiToken?: string;
}

export function createBankReconciler(deps: BankDeps) {
  const { repo } = deps;
  const alert = deps.alert ?? ((m: string) => console.error(`[ALERT][payments] ${m}`));
  const http = deps.http ?? fetch;

  /** Khớp 1 giao dịch tiền VÀO → payment → cấp quyền. Idempotent tuyệt đối (chạy lại 100 lần cũng không cộng trùng). */
  async function processTransfer(t: ParsedTransfer, raw: unknown): Promise<{ outcome: BankOutcome; paymentId?: string }> {
    const base: NewBankTransaction = {
      externalId: t.externalId,
      gateway: t.gateway,
      accountNumber: t.accountNumber,
      amount: t.amount,
      description: t.description,
      referenceCode: t.ref || undefined,
      transactionDate: t.transactionDate,
      rawPayload: raw,
    };
    const note = async (n: string, outcome: BankOutcome, paymentId?: string) => {
      await repo.markBankTransaction(t.externalId, { note: n, matchedPaymentId: paymentId ?? null });
      return { outcome, paymentId };
    };

    if (t.amount > MAX_SINGLE_AMOUNT) {
      await repo.recordBankTransaction({ ...base, note: `vượt trần ${MAX_SINGLE_AMOUNT}` });
      alert(`giao dịch ${t.externalId} ${t.amount}đ vượt trần — cần admin xem`);
      return { outcome: 'unmatched' };
    }

    const { row } = await repo.recordBankTransaction(base);
    if (row.credited) return { outcome: 'already', paymentId: row.matchedPaymentId };
    if (!t.ref) return note('không thấy mã tham chiếu trong nội dung CK', 'no_ref');

    const payment = await repo.findByRefCode(t.ref);
    if (!payment) return note(`không có phiên cho mã ${t.ref}`, 'unmatched');

    if (payment.status === 'succeeded' || payment.status === 'refunded') {
      if (payment.gatewayChargeId === t.externalId) {
        await repo.markBankTransaction(t.externalId, { credited: true, matchedPaymentId: payment.id });
        return { outcome: 'already', paymentId: payment.id };
      }
      // Phiên đã được trả bằng giao dịch khác ⇒ đây là khoản chuyển TRÙNG: không cấp lần 2, admin hoàn tay.
      alert(`mã ${t.ref} đã thanh toán xong nhưng nhận thêm ${t.amount}đ (giao dịch ${t.externalId}) — cần hoàn tiền thủ công`);
      return note(`mã ${t.ref} đã thanh toán trước đó — chuyển trùng, cần hoàn`, 'duplicate', payment.id);
    }

    const now = new Date();
    if (payment.status === 'failed' || (payment.expiresAt && new Date(payment.expiresAt) < now)) {
      if (payment.status === 'pending') await repo.transition(payment.id, ['pending'], { status: 'failed', failureReason: 'expired' });
      alert(`phiên ${t.ref} đã hết hạn/đóng nhưng nhận ${t.amount}đ — cần admin duyệt tay`);
      return note(`phiên ${t.ref} đã hết hạn/đóng (${payment.failureReason ?? 'expired'}) — duyệt tay`, 'expired', payment.id);
    }

    if (t.amount < payment.amountCents) {
      return note(`thiếu tiền: cần ${payment.amountCents}, nhận ${t.amount}`, 'underpaid', payment.id);
    }

    try {
      const settled = await deps.settle(payment, t.externalId);
      const extra = t.amount - payment.amountCents;
      const voided = settled.status === 'failed';
      await repo.markBankTransaction(t.externalId, {
        credited: true,
        matchedPaymentId: payment.id,
        note: voided ? 'trùng gói/module đã có — đã ghi nhận hoàn tiền' : extra > 0 ? `chuyển dư ${extra}đ — cần hoàn phần dư` : null,
      });
      if (extra > 0) alert(`mã ${t.ref} chuyển dư ${extra}đ (giao dịch ${t.externalId}) — cần hoàn phần dư`);
      return { outcome: 'credited', paymentId: payment.id };
    } catch (err) {
      // Tiền ĐÃ VÀO nhưng chưa cấp được (cộng đồng bị xóa/khóa, bị cấm...): payment vẫn 'pending', admin duyệt tay.
      const msg = err instanceof Error ? err.message : String(err);
      alert(`mã ${t.ref} nhận ${t.amount}đ nhưng chưa cấp được: ${msg} — cần admin duyệt tay`);
      return note(`chưa cấp được: ${msg}`, 'error', payment.id);
    }
  }

  return {
    /** (A) Webhook realtime. Sai/thiếu key ⇒ 401. Luôn trả 200 cho các case "đã xử lý rồi" (cổng thấy lỗi sẽ retry vô hạn). */
    async handleWebhook(authHeader: string | undefined, body: Record<string, unknown>) {
      if (!webhookAuthorized(authHeader)) throw HttpError.unauthorized('Unauthorized');
      const t = parseSepay(body);
      if (!t) return { success: true, message: 'bỏ qua (không phải tiền vào)' };
      const r = await processTransfer(t, body);
      return { success: r.outcome !== 'error', message: r.outcome };
    },

    /** (B) Kéo giao dịch vào gần nhất từ SePay rồi khớp. Không có token ⇒ bỏ qua êm (webhook vẫn chạy). Một giao dịch lỗi không làm sập vòng quét. */
    async scanAndReconcile(limit = 50) {
      const out = { scanned: 0, credited: 0, already: 0, unmatched: 0, underpaid: 0, errors: 0, skipped: false };
      const token = deps.apiToken ?? env.SEPAY_API_TOKEN;
      if (!token) return { ...out, skipped: true };
      let list: Record<string, unknown>[];
      try {
        const res = await http(`${env.SEPAY_API_BASE}/transactions/list?limit=${Math.max(1, Math.min(limit, 100))}`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(15_000),
        });
        if (res.status === 401) throw new Error('SEPAY_API_TOKEN sai hoặc đã bị thu hồi (401)');
        if (!res.ok) throw new Error(`API cổng ${res.status}`);
        const data = (await res.json()) as { transactions?: Record<string, unknown>[] };
        list = Array.isArray(data.transactions) ? data.transactions : [];
      } catch (err) {
        console.error('[payments] quét đối soát SePay thất bại:', err instanceof Error ? err.message : err);
        return { ...out, errors: 1 };
      }
      for (const raw of list) {
        const t = parseSepay(raw);
        if (!t) continue; // chỉ xét tiền VÀO
        out.scanned++;
        try {
          const r = await processTransfer(t, raw);
          if (r.outcome === 'credited') out.credited++;
          else if (r.outcome === 'already') out.already++;
          else if (r.outcome === 'underpaid') out.underpaid++;
          else if (r.outcome === 'error') out.errors++;
          else out.unmatched++;
        } catch (err) {
          console.error(`[payments] quét: giao dịch ${t.externalId} lỗi bất ngờ:`, err);
          out.errors++;
        }
      }
      return out;
    },
  };
}

export type BankReconciler = ReturnType<typeof createBankReconciler>;
