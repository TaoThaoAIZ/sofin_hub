import type { Page, TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const API_BASE = 'http://localhost:4000/api';
export const VALID_PASSWORD = 'Test@1234';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.join(__dirname, '..', 'evidence');
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

/**
 * Chụp 1 ảnh màn hình cuối test, đặt tên theo đúng mã TC (vd. TC-HOME-001.png) vào e2e/evidence/
 * — dùng làm bằng chứng riêng cho từng dòng trong Excel thay vì 1 link report chung.
 * Gọi từ `test.afterEach` khai báo TRỰC TIẾP trong TỪNG file spec (Playwright scope hook theo file
 * khai báo — khai báo afterEach ở đây trong helpers.ts rồi export sẽ KHÔNG áp dụng cho file import nó,
 * vì module chỉ được evaluate 1 lần cho cả worker).
 */
export async function snapEvidence(page: Page, testInfo: TestInfo) {
  const match = testInfo.title.match(/TC-[A-Z]+-\d+/);
  const name = match ? match[0] : testInfo.title.replace(/[^\w-]+/g, '_').slice(0, 60);
  const file = path.join(EVIDENCE_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: file, timeout: 5000 });
  } catch {
    // Trang có thể đã đóng/điều hướng đi ở cuối test (vd. test chỉ gọi API) — bỏ qua,
    // trace.zip trong e2e/report vẫn giữ đầy đủ bằng chứng (network, DOM snapshot...).
  }
}

let counter = 0;

export interface TestUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

/** Sinh 1 tài khoản test duy nhất (email không trùng giữa các lần chạy). */
export function uniqueUser(tag = 'user'): TestUser {
  counter += 1;
  const stamp = `${Date.now()}${counter}`;
  return {
    firstName: 'QA',
    lastName: `${tag}${stamp}`,
    email: `qa.${tag}.${stamp}@sofinhub.test`,
    password: VALID_PASSWORD,
  };
}

/** Bỏ qua bước cuộn hết /terms + /privacy — dùng cho các test KHÔNG kiểm tra chính cơ chế gate này. */
export async function bypassLegalConsent(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('sofinhub_terms_read', '1');
    sessionStorage.setItem('sofinhub_privacy_read', '1');
  });
}

/**
 * Tạo tài khoản thẳng qua API (không qua UI, không tính vào rate-limit của /login).
 * refresh_token cookie được Playwright tự lưu vào context — sau đó page.goto('/') sẽ tự đăng nhập
 * (AuthProvider gọi /api/auth/refresh khi mount).
 */
export async function registerViaApi(page: Page, user: TestUser = uniqueUser()) {
  const res = await page.request.post(`${API_BASE}/auth/register`, {
    data: { firstName: user.firstName, lastName: user.lastName, email: user.email, password: user.password },
  });
  if (!res.ok()) throw new Error(`register via API thất bại: ${res.status()} ${await res.text()}`);
  const verified = await verifyOtpViaApi(page, user.email);
  if (!verified.ok()) throw new Error(`verify OTP via API thất bại: ${verified.status()} ${await verified.text()}`);
  const body = (await verified.json()) as { data: { user: { id: string }; accessToken: string } };
  return { ...user, accessToken: body.data.accessToken, userId: body.data.user.id };
}

/** Mã OTP mới nhất gửi tới `email`, đọc từ hộp thư dev (cần backend chạy với ENABLE_DEV_OUTBOX=1). */
export async function readOtp(page: Page, email: string): Promise<string> {
  const res = await page.request.get(`${API_BASE}/dev/outbox?to=${encodeURIComponent(email)}`);
  if (!res.ok()) throw new Error(`không đọc được /dev/outbox: ${res.status()}`);
  const mails = ((await res.json()) as { data: { subject: string }[] }).data;
  const code = mails.map((m) => m.subject.match(/\b(\d{6})\b/)?.[1]).filter(Boolean).at(-1);
  if (!code) throw new Error(`không có OTP trong outbox cho ${email}`);
  return code;
}

/** Xác thực OTP đăng ký qua API (cookie refresh được Playwright lưu vào context như đăng nhập). */
export async function verifyOtpViaApi(page: Page, email: string) {
  return page.request.post(`${API_BASE}/auth/register/verify`, { data: { email, code: await readOtp(page, email) } });
}

/** Nhập mã OTP vào 6 ô ở trang /verify-otp (gõ liên tiếp, focus tự nhảy ô). */
export async function typeOtp(page: Page, code: string) {
  await page.getByLabel('Chữ số 1').click();
  await page.keyboard.type(code);
}

export async function fillRegisterForm(page: Page, user: TestUser) {
  await page.getByPlaceholder('Tên của bạn').fill(user.firstName);
  await page.getByPlaceholder('Họ của bạn').fill(user.lastName);
  await page.getByPlaceholder('Email của bạn').fill(user.email);
  await page.getByPlaceholder('Mật khẩu').fill(user.password);
}

export async function fillLoginForm(page: Page, email: string, password: string) {
  await page.getByPlaceholder('Email của bạn').fill(email);
  await page.getByPlaceholder('Mật khẩu').fill(password);
}

/** Đăng nhập thật qua UI form — CHỈ dùng cho các test test chính luồng đăng nhập (tốn quota rate-limit). */
export async function loginViaUi(page: Page, email: string, password: string) {
  await page.goto('/login');
  await fillLoginForm(page, email, password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}
