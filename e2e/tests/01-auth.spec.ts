import { test, expect } from '@playwright/test';
import {
  API_BASE,
  bypassLegalConsent,
  fillLoginForm,
  fillRegisterForm,
  readOtp,
  registerViaApi,
  snapEvidence,
  typeOtp,
  uniqueUser,
  VALID_PASSWORD,
  verifyOtpViaApi,
} from './helpers';

test.afterEach(async ({ page }, testInfo) => {
  await snapEvidence(page, testInfo);
});

test.describe('Tài khoản & Xác thực', () => {
  test('TC-AUTH-001: Đăng ký tài khoản thành công với thông tin hợp lệ', async ({ page }) => {
    await bypassLegalConsent(page);
    const user = uniqueUser('reg-ok');
    await page.goto('/register');
    await fillRegisterForm(page, user);
    await expect(page.getByRole('checkbox')).toBeEnabled();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Đăng ký ngay' }).click();
    // Đăng ký không cấp phiên: sang màn nhập OTP gửi về email, nhập đúng mã mới vào được hệ thống.
    await expect(page).toHaveURL(/\/verify-otp\?email=/);
    await typeOtp(page, await readOtp(page, user.email));
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: user.firstName })).toBeVisible();
  });

  test('TC-AUTH-002: Đăng ký với email đã tồn tại', async ({ page }) => {
    await bypassLegalConsent(page);
    const existing = await registerViaApi(page, uniqueUser('dup'));
    await page.goto('/register');
    await fillRegisterForm(page, { ...uniqueUser('dup2'), email: existing.email });
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Đăng ký ngay' }).click();
    await expect(page.getByRole('alert')).toContainText(/đã được (sử dụng|đăng ký)|đã tồn tại/i);
    await expect(page).toHaveURL(/\/register$/);
  });

  test('TC-AUTH-003: Đăng ký với email sai định dạng', async ({ page }) => {
    await bypassLegalConsent(page);
    const user = uniqueUser('bademail');
    await page.goto('/register');
    await fillRegisterForm(page, { ...user, email: 'abc@.com' });
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Đăng ký ngay' }).click();
    await expect(page.getByText('Email không hợp lệ')).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('TC-AUTH-004: Mật khẩu ít hơn 8 ký tự bị từ chối', async ({ page }) => {
    await bypassLegalConsent(page);
    const user = uniqueUser('shortpw');
    await page.goto('/register');
    await fillRegisterForm(page, { ...user, password: 'Ab@12' });
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Đăng ký ngay' }).click();
    await expect(page.getByText('Mật khẩu cần ít nhất 8 ký tự')).toBeVisible();
  });

  test('TC-AUTH-005: Mật khẩu không có chữ hoa bị từ chối', async ({ page }) => {
    await bypassLegalConsent(page);
    const user = uniqueUser('nouppercase');
    await page.goto('/register');
    await fillRegisterForm(page, { ...user, password: 'test@1234' });
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Đăng ký ngay' }).click();
    await expect(page.getByText('Mật khẩu cần ít nhất 1 chữ in hoa')).toBeVisible();
  });

  test('TC-AUTH-006: Mật khẩu không có ký tự đặc biệt bị từ chối', async ({ page }) => {
    await bypassLegalConsent(page);
    const user = uniqueUser('nospecial');
    await page.goto('/register');
    await fillRegisterForm(page, { ...user, password: 'Test1234' });
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Đăng ký ngay' }).click();
    await expect(page.getByText('Mật khẩu cần ít nhất 1 ký tự đặc biệt')).toBeVisible();
  });

  test('TC-AUTH-007: Để trống trường họ tên', async ({ page }) => {
    await bypassLegalConsent(page);
    const user = uniqueUser('nolastname');
    await page.goto('/register');
    await fillRegisterForm(page, { ...user, lastName: '' });
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Đăng ký ngay' }).click();
    await expect(page.getByText('Vui lòng nhập họ')).toBeVisible();
  });

  test('TC-AUTH-008: Không thể tick đồng ý khi chưa cuộn hết Điều khoản sử dụng', async ({ page }) => {
    const user = uniqueUser('gate-terms');
    await page.goto('/register');
    await fillRegisterForm(page, user);
    await expect(page.getByRole('checkbox')).toBeDisabled();
    await page.getByRole('link', { name: 'Điều khoản sử dụng' }).click();
    await expect(page).toHaveURL(/\/terms$/);
    // Chưa cuộn tới cuối -> quay lại register, checkbox vẫn phải bị khóa
    await page.getByRole('link', { name: 'Quay lại đăng ký' }).click();
    await expect(page.getByRole('checkbox')).toBeDisabled();
  });

  test('TC-AUTH-009: Không thể tick đồng ý khi chưa cuộn hết Chính sách bảo mật', async ({ page }) => {
    const user = uniqueUser('gate-privacy');
    await page.goto('/register');
    await fillRegisterForm(page, user);
    await page.getByRole('link', { name: 'Chính sách bảo mật' }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await page.getByRole('link', { name: 'Quay lại đăng ký' }).click();
    await expect(page.getByRole('checkbox')).toBeDisabled();
  });

  test('TC-AUTH-010: Không cho đăng ký khi chưa tick đồng ý điều khoản', async ({ page }) => {
    await bypassLegalConsent(page);
    const user = uniqueUser('noagree');
    await page.goto('/register');
    await fillRegisterForm(page, user);
    await expect(page.getByRole('button', { name: 'Đăng ký ngay' })).toBeDisabled();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('TC-AUTH-011: Kiểm tra input chống XSS/SQL injection ở các trường đăng ký', async ({ page }) => {
    await bypassLegalConsent(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const user = uniqueUser('xss');
    await page.goto('/register');
    await fillRegisterForm(page, { ...user, firstName: "<script>alert(1)</script>", lastName: "' OR '1'='1" });
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Đăng ký ngay' }).click();
    await page.waitForTimeout(500);
    expect(errors, 'Không thực thi script trên trang').toEqual([]);
    const dialogFired = await page.evaluate(() => (window as unknown as { __xssFired?: boolean }).__xssFired ?? false);
    expect(dialogFired).toBe(false);
  });

  test('TC-AUTH-012: Đăng nhập thành công với email/mật khẩu đúng', async ({ page }) => {
    const user = await registerViaApi(page, uniqueUser('login-ok'));
    await page.context().clearCookies();
    await page.goto('/login');
    await fillLoginForm(page, user.email, user.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: user.firstName })).toBeVisible();
  });

  test('TC-AUTH-013: Đăng nhập với mật khẩu sai', async ({ page }) => {
    const user = await registerViaApi(page, uniqueUser('login-badpw'));
    await page.context().clearCookies();
    await page.goto('/login');
    await fillLoginForm(page, user.email, 'MatKhauSai@999');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByRole('alert')).toContainText(/không đúng/i);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('TC-AUTH-014: Đăng nhập với email không tồn tại', async ({ page }) => {
    await page.goto('/login');
    await fillLoginForm(page, `khong-ton-tai-${Date.now()}@sofinhub.test`, 'AnyPass@123');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByRole('alert')).toContainText(/không đúng/i);
  });

  test('TC-AUTH-016: Phiên đăng nhập được giữ khi tải lại trang (F5)', async ({ page }) => {
    const user = await registerViaApi(page, uniqueUser('f5'));
    await page.goto('/');
    await expect(page.getByRole('button', { name: user.firstName })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: user.firstName })).toBeVisible();
  });

  test('TC-AUTH-017: Đăng xuất khỏi hệ thống', async ({ page }) => {
    const user = await registerViaApi(page, uniqueUser('logout'));
    await page.goto('/');
    await page.getByRole('button', { name: user.firstName }).click();
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page.getByRole('link', { name: 'Đăng nhập' })).toBeVisible();
  });

  test('TC-AUTH-018: Sau khi đăng xuất, back trình duyệt không tự khôi phục phiên', async ({ page }) => {
    const user = await registerViaApi(page, uniqueUser('back-after-logout'));
    await page.goto('/');
    await page.goto('/courses/py');
    await page.goto('/');
    await page.getByRole('button', { name: user.firstName }).click();
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page.getByRole('link', { name: 'Đăng nhập' })).toBeVisible();
    await page.goBack();
    await page.waitForLoadState('networkidle');
    // refresh_token cookie đã bị revoke server-side (revokeAllRefreshTokens) -> refresh-on-mount phải thất bại
    await expect(page.getByRole('link', { name: 'Đăng nhập' })).toBeVisible();
  });

  test('TC-AUTH-025: Mật khẩu đúng đủ 8 ký tự (giá trị biên) được chấp nhận', async ({ page }) => {
    const user = uniqueUser('boundary8');
    const res = await page.request.post(`${API_BASE}/auth/register`, {
      data: { ...user, password: 'Aa1@bcde' },
    });
    expect(res.status(), await res.text()).toBe(202);
  });

  test('TC-AUTH-026: Họ tên chứa ký tự tiếng Việt có dấu', async ({ page }) => {
    const user = uniqueUser('vn-name');
    const res = await page.request.post(`${API_BASE}/auth/register`, {
      data: { ...user, firstName: 'Nguyễn', lastName: 'Văn Ánh' },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const verified = await verifyOtpViaApi(page, user.email);
    expect(verified.ok(), await verified.text()).toBeTruthy();
    const body = (await verified.json()).data.user;
    expect(body.firstName).toBe('Nguyễn');
    expect(body.lastName).toBe('Văn Ánh');
  });

  test('TC-AUTH-027: Email chuẩn hóa chữ hoa/thường khi kiểm tra trùng lặp', async ({ page }) => {
    const user = uniqueUser('case-norm');
    const first = await page.request.post(`${API_BASE}/auth/register`, { data: user });
    expect(first.ok()).toBeTruthy();
    // Email của tài khoản CHƯA xác thực được đăng ký lại (ghi đè); chỉ email đã xác thực mới bị coi là trùng.
    expect((await verifyOtpViaApi(page, user.email)).ok()).toBeTruthy();
    const second = await page.request.post(`${API_BASE}/auth/register`, {
      data: { ...uniqueUser('case-norm2'), email: user.email.toUpperCase() },
    });
    expect(second.status(), 'Đăng ký lại bằng email viết HOA phải bị coi là trùng (409)').toBe(409);
  });

  test('TC-AUTH-028: Mật khẩu chứa khoảng trắng ở giữa — FE và BE nhất quán', async ({ page }) => {
    const user = uniqueUser('space-pw');
    const password = 'Ab@12 34';
    await bypassLegalConsent(page);
    await page.goto('/register');
    await fillRegisterForm(page, { ...user, password });
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Đăng ký ngay' }).click();
    // FE (validateNewPassword) không có rule chặn khoảng trắng -> đăng ký thành công, sang màn nhập OTP
    await expect(page).toHaveURL(/\/verify-otp\?email=/, { timeout: 5000 });
    const beRes = await page.request.post(`${API_BASE}/auth/register`, {
      data: { ...uniqueUser('space-pw-api'), password },
    });
    expect(beRes.ok(), 'BE (zod schema) cũng không chặn khoảng trắng — nhất quán với FE').toBeTruthy();
  });

  test('TC-AUTH-030: Đăng nhập đồng thời trên nhiều thiết bị khác nhau không bị đá nhau', async ({ page, browser }) => {
    const user = await registerViaApi(page, uniqueUser('multi-device'));
    await page.goto('/');
    await expect(page.getByRole('button', { name: user.firstName })).toBeVisible();

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto('/login');
    await fillLoginForm(page2, user.email, user.password);
    await page2.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page2).toHaveURL('/');
    await expect(page2.getByRole('button', { name: user.firstName })).toBeVisible();

    // Thiết bị 1 vẫn còn phiên hợp lệ
    await page.reload();
    await expect(page.getByRole('button', { name: user.firstName })).toBeVisible();
    await context2.close();
  });

  test('TC-AUTH-031: Access token bị chỉnh sửa (tamper) bị từ chối', async ({ page }) => {
    const user = await registerViaApi(page, uniqueUser('tamper'));
    const tampered = user.accessToken.slice(0, -3) + (user.accessToken.slice(-3) === 'xxx' ? 'yyy' : 'xxx');
    const res = await page.request.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${tampered}` },
    });
    expect(res.status()).toBe(401);
  });

  test.skip('TC-AUTH-032: Refresh token hết hạn không dùng lại được — CẦN MÔI TRƯỜNG RIÊNG', async () => {
    // REFRESH_TOKEN_TTL_DAYS=30 theo backend/.env.example — không thể chờ thật 30 ngày trong lần chạy này.
    // Cần: 1 backend instance test riêng với REFRESH_TOKEN_TTL_DAYS rất nhỏ (vd. set qua env trước khi start),
    // hoặc endpoint/test-hook riêng cho phép cấp 1 refresh token đã hết hạn để verify /api/auth/refresh từ chối nó.
  });

  test('TC-AUTH-033: Dùng token của tài khoản khác để giả mạo truy cập dữ liệu', async ({ page }) => {
    const userA = await registerViaApi(page, uniqueUser('victimA'));
    const userB = await registerViaApi(page, uniqueUser('victimB'));
    const res = await page.request.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${userB.accessToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()).data;
    expect(body.email).toBe(userB.email.toLowerCase());
    expect(body.email).not.toBe(userA.email.toLowerCase());
  });

  test('TC-AUTH-035: Trường mật khẩu không hiển thị dạng plain text mặc định', async ({ page }) => {
    await page.goto('/register');
    const pwInput = page.getByPlaceholder('Mật khẩu');
    await pwInput.fill('Test@1234');
    await expect(pwInput).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
    await expect(pwInput).toHaveAttribute('type', 'text');
  });

  test('TC-AUTH-036: API có từ chối request dùng access token cũ ngay sau khi đăng xuất?', async ({ page }) => {
    const user = await registerViaApi(page, uniqueUser('logout-token'));
    const logoutRes = await page.request.post(`${API_BASE}/auth/logout`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    });
    expect(logoutRes.status()).toBe(204);

    const meRes = await page.request.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    });
    if (meRes.ok()) {
      test.info().annotations.push({
        type: 'finding',
        description:
          'BUG/GAP: access token cũ vẫn dùng được sau khi đăng xuất (trả về 200 thay vì 401). ' +
          'Nguyên nhân: backend/src/modules/auth/tokens.ts — logout() chỉ revoke refresh token ' +
          '(revokeAllRefreshTokens), access token là JWT stateless không có cơ chế thu hồi/blacklist, ' +
          'nên vẫn hợp lệ cho tới khi tự hết hạn (15 phút). Access token bị lộ (XSS, log...) vẫn dùng được sau logout.',
      });
    }
    expect(meRes.status(), 'Xem annotation "finding" ở trên nếu test này FAIL — đây là gap bảo mật thật, không phải lỗi test').toBe(401);
  });
});
