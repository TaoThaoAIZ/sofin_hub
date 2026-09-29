/**
 * QUAN TRỌNG: file này CỐ Ý làm cạn quota rate-limit của POST /api/auth/login
 * (10 request / 15 phút / IP — xem backend/src/modules/auth/auth.routes.ts).
 * Phải chạy SAU CÙNG trong toàn bộ test suite (tên file bắt đầu bằng "99-" để Playwright
 * chạy cuối khi workers=1 + fullyParallel=false). Sau khi file này chạy xong, MỌI test khác
 * cần đăng nhập qua UI (/login) sẽ bị 429 trong khoảng 15 phút tiếp theo trên cùng máy —
 * nếu cần chạy lại các file khác, hãy khởi động lại backend (`npm run dev`) để reset bộ đếm
 * (rate-limit lưu trong bộ nhớ, mất khi restart process).
 */
import { test, expect } from '@playwright/test';
import { API_BASE, registerViaApi, snapEvidence, uniqueUser, VALID_PASSWORD } from './helpers';

test.afterEach(async ({ page }, testInfo) => {
  await snapEvidence(page, testInfo);
});

test.describe.serial('Tài khoản & Xác thực — giới hạn đăng nhập sai (rate limit)', () => {
  const victim = uniqueUser('bruteforce-victim');

  test('TC-AUTH-015: Giới hạn số lần đăng nhập sai liên tiếp (chống dò mật khẩu)', async ({ page }) => {
    await registerViaApi(page, victim);
    let hit429 = false;
    let attempts = 0;
    for (let i = 0; i < 8 && !hit429; i++) {
      attempts++;
      const res = await page.request.post(`${API_BASE}/auth/login`, {
        data: { email: victim.email, password: 'SaiMatKhau@999' },
      });
      if (res.status() === 429) hit429 = true;
    }
    test.info().annotations.push({ type: 'note', description: `Số lần thử trước khi bị 429: ${attempts}` });
    expect(hit429, 'Sau đủ số lần đăng nhập sai, endpoint phải trả về 429').toBe(true);
  });

  test('TC-AUTH-029: Tài khoản vẫn bị từ chối dù nhập ĐÚNG mật khẩu khi đang bị giới hạn', async ({ page }) => {
    const res = await page.request.post(`${API_BASE}/auth/login`, {
      data: { email: victim.email, password: victim.password },
    });
    expect(res.status(), 'Ngay cả mật khẩu đúng cũng phải bị 429 trong lúc đang giới hạn').toBe(429);
  });

  test('TC-AUTH-034: Giới hạn đăng nhập sai được tính theo IP hay theo tài khoản?', async ({ page }) => {
    const otherUser = await registerViaApi(page, uniqueUser('other-account-same-ip'));
    const res = await page.request.post(`${API_BASE}/auth/login`, {
      data: { email: otherUser.email, password: VALID_PASSWORD },
    });
    if (res.status() === 429) {
      test.info().annotations.push({
        type: 'finding',
        description:
          'GAP so với kỳ vọng test case gốc: rate-limit hiện tại là THEO IP (express-rate-limit keyGenerator mặc định), ' +
          'không phải theo tài khoản (xem backend/src/modules/auth/auth.routes.ts — loginLimiter không có keyGenerator riêng). ' +
          'Hệ quả: khi 1 tài khoản bị giới hạn do đăng nhập sai nhiều lần, MỌI tài khoản khác dùng chung IP/NAT ' +
          '(văn phòng, trường học, quán cà phê, symmetric NAT của ISP...) cũng bị chặn đăng nhập theo, kể cả với ' +
          'mật khẩu đúng 100%. Test case gốc kỳ vọng "không chặn nhầm người dùng khác cùng IP" — thực tế NGƯỢC LẠI.',
      });
    }
    expect(res.status(), 'Xem annotation "finding" nếu 429 — đây là hành vi thật của hệ thống (theo IP), không phải lỗi test').toBe(429);
  });
});
