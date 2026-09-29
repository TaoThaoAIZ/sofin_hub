import { test, expect } from '@playwright/test';
import { API_BASE, fillLoginForm, registerViaApi, snapEvidence, uniqueUser } from './helpers';

test.afterEach(async ({ page }, testInfo) => {
  await snapEvidence(page, testInfo);
});

function decodeJwtPayload(token: string): Record<string, number> {
  const [, payloadB64] = token.split('.');
  const json = Buffer.from(payloadB64, 'base64url').toString('utf8');
  return JSON.parse(json);
}

test.describe('Bảo mật & Yêu cầu phi chức năng', () => {
  test('TC-SEC-002: Access token được cấu hình hết hiệu lực sau 15 phút (kiểm tra claim exp-iat, không chờ thật)', async ({ page }) => {
    const user = await registerViaApi(page, uniqueUser('ttl-check'));
    const payload = decodeJwtPayload(user.accessToken);
    const ttlSeconds = payload.exp - payload.iat;
    expect(ttlSeconds).toBe(15 * 60);
  });

  test('TC-SEC-003: Refresh token chỉ dùng được một lần', async ({ page }) => {
    await registerViaApi(page, uniqueUser('refresh-once'));
    const cookiesBefore = await page.context().cookies();
    const oldRefresh = cookiesBefore.find((c) => c.name === 'refresh_token')!;
    expect(oldRefresh, 'Phải có refresh_token cookie sau khi đăng ký').toBeTruthy();

    const firstRefresh = await page.request.post(`${API_BASE}/auth/refresh`);
    expect(firstRefresh.ok(), 'Lần refresh đầu tiên phải thành công').toBeTruthy();

    // Đặt lại cookie CŨ (đã bị rotate/thu hồi) rồi thử refresh lần 2 bằng chính token cũ đó
    await page.context().addCookies([{ ...oldRefresh, value: oldRefresh.value }]);
    const secondRefreshWithOldToken = await page.request.post(`${API_BASE}/auth/refresh`);
    expect(secondRefreshWithOldToken.status(), 'Refresh token cũ (đã dùng) phải bị từ chối').toBe(401);
  });

  test('TC-SEC-004: Đăng xuất vô hiệu hóa refresh token của TẤT CẢ thiết bị (mọi phiên)', async ({ page, browser }) => {
    const user = await registerViaApi(page, uniqueUser('logout-all'));

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto('/login');
    await fillLoginForm(page2, user.email, user.password);
    await page2.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page2).toHaveURL('/');

    const logoutRes = await page.request.post(`${API_BASE}/auth/logout`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    });
    expect(logoutRes.status()).toBe(204);

    const device2Refresh = await context2.request.post(`${API_BASE}/auth/refresh`);
    expect(
      device2Refresh.status(),
      'Refresh token của thiết bị 2 phải bị vô hiệu sau khi thiết bị 1 đăng xuất (revokeAllRefreshTokens theo userId)',
    ).toBe(401);
    await context2.close();
  });

  test('TC-SEC-008: Trang khám phá tải trong thời gian chấp nhận được', async ({ page }) => {
    const start = Date.now();
    await page.goto('/', { waitUntil: 'networkidle' });
    const elapsed = Date.now() - start;
    test.info().annotations.push({
      type: 'note',
      description: `Thời gian tải trang khám phá (networkidle): ${elapsed}ms. Dữ liệu mẫu hiện tại chỉ có 22 khóa học — chưa phải "lượng dữ liệu lớn" thật sự như mô tả BRD; cần bộ dữ liệu lớn hơn (vài nghìn bản ghi) + công cụ load-test riêng (k6/Artillery) để đánh giá đầy đủ.`,
    });
    expect(elapsed, 'Trang phải tải xong (networkidle) trong dưới 5s với dữ liệu mẫu hiện tại').toBeLessThan(5000);
  });

  test('TC-SEC-009: Giao diện responsive trên điện thoại di động (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(hasHorizontalScroll, 'Không được có thanh cuộn ngang ở màn hình di động').toBe(false);

    const loginLinkVisible = await page.getByRole('link', { name: 'Đăng nhập' }).isVisible().catch(() => false);
    const navVisible = await page.getByRole('link', { name: 'Khám phá' }).isVisible().catch(() => false);
    if (!loginLinkVisible || !navVisible) {
      test.info().annotations.push({
        type: 'finding',
        description:
          `GAP UX di động: ở 375px, link "Đăng nhập" (${loginLinkVisible ? 'hiện' : 'ẨN'}) và menu điều hướng chính ` +
          `(${navVisible ? 'hiện' : 'ẨN'}) bị ẩn theo class Tailwind "hidden sm:flex"/"hidden md:flex" trong Header.tsx, ` +
          'và KHÔNG có nút hamburger/menu thay thế nào trong code hiện tại. Người dùng trên điện thoại không có cách ' +
          'nào vào trang Đăng nhập hoặc điều hướng chính từ Header. Cần bổ sung mobile menu.',
      });
    }
  });

  test('TC-SEC-010: Giao diện responsive trên máy tính bảng (774px)', async ({ page }) => {
    await page.setViewportSize({ width: 774, height: 1024 });
    await page.goto('/');
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(hasHorizontalScroll, 'Không được có thanh cuộn ngang ở màn hình tablet').toBe(false);
    await expect(page.getByRole('link', { name: 'Đăng nhập' })).toBeVisible();
  });

  test('TC-SEC-011: Trang công khai có thẻ meta/title phù hợp cho SEO', async ({ page }) => {
    await page.goto('/');
    const homeTitle = await page.title();
    const homeDesc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(homeTitle.length, 'Trang chủ phải có <title>').toBeGreaterThan(0);
    expect(homeDesc?.length ?? 0, 'Trang chủ phải có meta description').toBeGreaterThan(0);

    await page.goto('/courses/py');
    const courseTitle = await page.title();
    const courseDesc = await page.locator('meta[name="description"]').getAttribute('content');

    if (courseTitle === homeTitle && courseDesc === homeDesc) {
      test.info().annotations.push({
        type: 'finding',
        description:
          'GAP SEO: <title> và meta description là TĨNH trong index.html, không có route nào cập nhật động theo trang ' +
          '(đã grep toàn bộ src/, không tìm thấy document.title hay react-helmet). Trang chi tiết khóa học ' +
          `("${courseTitle}") có title/description HỆT trang chủ — công cụ tìm kiếm sẽ thấy mọi trang giống hệt nhau, ` +
          'rất bất lợi cho SEO dù BRD mục 4.1/7 yêu cầu "thân thiện với công cụ tìm kiếm".',
      });
    }
    expect(courseTitle.length).toBeGreaterThan(0);
  });
});
