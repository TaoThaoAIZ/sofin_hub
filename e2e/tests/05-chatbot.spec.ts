import { expect, test, type Page } from '@playwright/test';
import { API_BASE, fillLoginForm, snapEvidence } from './helpers';

/**
 * Chatbot hỗ trợ (chatbot.md). Backend phải chạy với model giả để không gọi OpenAI:
 *   cd backend && CHATBOT_FAKE_MODEL=1 npm run dev     (dữ liệu: npm run db:seed)
 */
test.afterEach(async ({ page }, testInfo) => {
  await snapEvidence(page, testInfo);
});

const PW = 'Passw0rd!x';

async function uiLogin(page: Page, email: string) {
  const r = await page.request.post(`${API_BASE}/auth/login`, { data: { email, password: PW } });
  expect(r.ok(), await r.text()).toBeTruthy();
  await page.goto('/');
}

const openWidget = async (page: Page) => {
  await page.getByRole('button', { name: 'Mở trợ lý hỗ trợ' }).click();
  const panel = page.getByRole('dialog', { name: /trợ lý SofinHub/ });
  await expect(panel).toBeVisible();
  // Bắt đầu cuộc mới để không phụ thuộc hội thoại cũ.
  await panel.getByRole('button', { name: 'Cuộc mới' }).click();
  return panel;
};

const ask = async (panel: ReturnType<Page['getByRole']>, text: string) => {
  await panel.getByLabel('Nhập câu hỏi…').fill(text);
  await panel.getByRole('button', { name: 'Gửi' }).click();
};

test.describe('Chatbot hỗ trợ', () => {
  test('TC-CHATBOT-001: khách chưa đăng nhập không thấy trợ lý', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Mở trợ lý hỗ trợ' })).toHaveCount(0);
  });

  test('TC-CHATBOT-002: hỏi câu có trong kho mẫu => trả lời ngay theo câu admin', async ({ page }) => {
    await uiLogin(page, 'member1@sofinhub.test');
    const panel = await openWidget(page);
    await ask(panel, 'Tôi quên mật khẩu thì làm sao?');
    // Dữ liệu nền v5: đủ ý + chip link trang Quên mật khẩu.
    await expect(panel.getByText(/hiệu lực 30 phút/)).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Quên mật khẩu' })).toHaveAttribute('href', '/forgot-password');
    await expect(panel.getByRole('button', { name: 'Câu trả lời hữu ích' }).last()).toBeVisible();
  });

  test('TC-CHATBOT-003: hỏi về tool => trả lời kèm thẻ tool có nút Mua ngay', async ({ page }) => {
    await uiLogin(page, 'member1@sofinhub.test');
    const panel = await openWidget(page);
    await ask(panel, 'tool grok automation dùng để làm gì');
    await expect(panel.getByRole('link', { name: 'Mua ngay' }).first()).toBeVisible();
    // Đường dẫn trong câu trả lời hiện thành TÊN TRANG tô màu (không hiện "/tools").
    await expect(panel.getByRole('link', { name: 'Tải Tool' }).first()).toHaveAttribute('href', '/tools');
    await expect(panel.getByText('/tools', { exact: false })).toHaveCount(0);
  });

  test('TC-CHATBOT-004: câu ngoài phạm vi bị từ chối', async ({ page }) => {
    await uiLogin(page, 'member1@sofinhub.test');
    const panel = await openWidget(page);
    await ask(panel, 'viết giúp tôi một bài thơ');
    await expect(panel.getByText(/chỉ hỗ trợ các câu hỏi về SofinHub/)).toBeVisible();
  });

  test('TC-CHATBOT-005: gặp người hỗ trợ => hiện mã hỗ trợ', async ({ page }) => {
    await uiLogin(page, 'member2@sofinhub.test');
    const panel = await openWidget(page);
    await panel.getByRole('button', { name: 'Gặp người hỗ trợ' }).or(panel.getByRole('link', { name: 'Nhắn Zalo hỗ trợ' })).click();
    await expect(panel.getByText(/Mã hỗ trợ của bạn: T-\d+/)).toBeVisible();
  });

  test('TC-CHATBOT-007: hỏi chung về khóa học => bot hỏi lại chủ đề kèm nút gợi ý; bấm gợi ý => khóa học của chủ đề', async ({ page }) => {
    await uiLogin(page, 'member1@sofinhub.test');
    const panel = await openWidget(page);
    await ask(panel, 'bên mình có những khóa học nào vậy');
    await expect(panel.getByText(/quan tâm chủ đề nào/)).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Khám phá khóa học' })).toHaveAttribute('href', '/explore');
    const chips = panel.getByRole('group', { name: 'Gợi ý trả lời nhanh' }).getByRole('button');
    await expect(chips.first()).toBeVisible();
    await chips.first().click();
    await expect(panel.getByRole('link', { name: 'trang cộng đồng' }).last()).toHaveAttribute('href', /^\/communities\//);
    await expect(panel.getByRole('group', { name: 'Gợi ý trả lời nhanh' })).toHaveCount(0);
  });

  test('TC-CHATBOT-008: nhắn liên tục 3 tin khi Tào đang trả lời => tin sau "chờ gửi", gộp thành 1 lượt, không mất tin', async ({ page }) => {
    await uiLogin(page, 'member1@sofinhub.test');
    const panel = await openWidget(page);
    // Làm chậm lượt đầu để khách kịp gõ thêm khi bot đang xử lý; đếm số lượt gửi lên server.
    const sent: string[] = [];
    await page.route('**/chatbot/conversations/*/messages', async (route) => {
      sent.push(String(route.request().postDataJSON()?.text ?? ''));
      if (sent.length === 1) await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    await ask(panel, 'alo tào ơi');
    await expect(panel.getByText('Tào đang trả lời…')).toBeVisible();
    await ask(panel, 'cho hỏi chút');
    await ask(panel, 'tool grok làm được gì');
    await expect(panel.getByText(/chờ gửi/)).toHaveCount(2);
    // Lượt 2 gộp 2 tin chờ => tổng 2 lượt gửi, đủ 3 tin của khách, không còn tin chờ.
    await expect(panel.getByRole('link', { name: 'Mua ngay' }).first()).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByText(/chờ gửi/)).toHaveCount(0);
    expect(sent).toEqual(['alo tào ơi', 'cho hỏi chút\ntool grok làm được gì']);
    for (const t of ['alo tào ơi', 'cho hỏi chút', 'tool grok làm được gì']) await expect(panel.getByText(t, { exact: true })).toBeVisible();
  });

  /** Làm chậm lượt gửi tin đầu tiên `ms` mili giây (để kịp thao tác khi bot đang trả lời). */
  const slowFirstSend = async (page: Page, ms: number) => {
    let n = 0;
    await page.route('**/chatbot/conversations/*/messages', async (route) => {
      n += 1;
      if (n === 1) await new Promise((r) => setTimeout(r, ms));
      await route.continue();
    });
  };

  test('TC-CHATBOT-009 (CB-02-06): đóng khung chat khi Tào đang trả lời, mở lại vẫn thấy câu hỏi + câu trả lời', async ({ page }) => {
    await uiLogin(page, 'member1@sofinhub.test');
    const panel = await openWidget(page);
    await slowFirstSend(page, 2000);
    await ask(panel, 'Có hoàn tiền không?');
    await expect(panel.getByText('Tào đang trả lời…')).toBeVisible();
    await panel.getByRole('button', { name: 'Đóng' }).click();
    await expect(panel).toBeHidden();
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Mở trợ lý hỗ trợ' }).click();
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Có hoàn tiền không?', { exact: true })).toHaveCount(1);
    await expect(panel.getByText(/không hỗ trợ hoàn tiền/)).toHaveCount(1);
  });

  test('TC-CHATBOT-010 (CB-11-02): bấm "Cuộc mới" khi Tào đang trả lời => câu trả lời cũ không chèn vào cuộc mới', async ({ page }) => {
    await uiLogin(page, 'member1@sofinhub.test');
    const panel = await openWidget(page);
    await slowFirstSend(page, 2000);
    await ask(panel, 'hoàn tiền được không');
    await expect(panel.getByText('Tào đang trả lời…')).toBeVisible();
    await panel.getByRole('button', { name: 'Cuộc mới' }).click();
    await expect(panel.getByText(/Tào nghe đây/)).toBeVisible();
    await page.waitForTimeout(3000);
    await expect(panel.getByText(/không hỗ trợ hoàn tiền/)).toHaveCount(0);
    await expect(panel.getByText('hoàn tiền được không', { exact: true })).toHaveCount(0);
    // Tin tiếp theo vào đúng cuộc mới.
    await ask(panel, 'Tôi quên mật khẩu thì làm sao?');
    await expect(panel.getByText(/hiệu lực 30 phút/)).toBeVisible();
    await expect(panel.getByText(/không hỗ trợ hoàn tiền/)).toHaveCount(0);
  });

  test('TC-CHATBOT-011 (CB-11-05): đăng xuất A rồi đăng nhập B (không tải lại trang) => B không thấy tin của A', async ({ page }) => {
    await uiLogin(page, 'member1@sofinhub.test');
    const panel = await openWidget(page);
    await ask(panel, 'hoàn tiền được không');
    await expect(panel.getByText(/không hỗ trợ hoàn tiền/)).toBeVisible();
    await panel.getByRole('button', { name: 'Đóng' }).click();
    await page.getByRole('button', { name: /^Tài khoản của/ }).click();
    await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
    await page.getByRole('link', { name: 'Đăng nhập' }).first().click();
    await fillLoginForm(page, 'member2@sofinhub.test', PW);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.getByRole('button', { name: 'Mở trợ lý hỗ trợ' }).click();
    const panelB = page.getByRole('dialog', { name: /trợ lý SofinHub/ });
    await expect(panelB).toBeVisible();
    await expect(panelB.getByText('hoàn tiền được không', { exact: true })).toHaveCount(0);
  });

  test('TC-CHATBOT-012 (CB-12-04): stream bị ngắt giữa chừng => câu báo tiếng Việt, không hiện "stream ended"', async ({ page }) => {
    await uiLogin(page, 'member1@sofinhub.test');
    const panel = await openWidget(page);
    await page.route('**/chatbot/conversations/*/messages', (route) =>
      route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: 'event: delta\ndata: {"text":"dạ"}\n\n' }),
    );
    await ask(panel, 'alo');
    await expect(panel.getByRole('alert')).toContainText('Kết nối bị gián đoạn');
    await expect(panel.getByText(/stream/)).toHaveCount(0);
    await expect(panel.getByLabel('Nhập câu hỏi…')).toHaveValue('alo');
  });

  test('TC-CHATBOT-013 (CB-05-12, CB-05-13): ô nhập tự giãn; tin nhiều dòng là 1 bong bóng cả lúc chờ lẫn sau khi xong', async ({ page }) => {
    await uiLogin(page, 'member1@sofinhub.test');
    const panel = await openWidget(page);
    const input = panel.getByLabel('Nhập câu hỏi…');
    const h1 = (await input.boundingBox())!.height;
    await input.fill('Dòng 1\nDòng 2\nDòng 3');
    expect((await input.boundingBox())!.height).toBeGreaterThan(h1 + 20);
    await input.fill(Array.from({ length: 12 }, (_, i) => `Dòng ${i + 1}`).join('\n'));
    expect((await input.boundingBox())!.height).toBeLessThanOrEqual(130);
    await slowFirstSend(page, 1500);
    await input.fill('Dòng 1\nDòng 2');
    await panel.getByRole('button', { name: 'Gửi' }).click();
    await expect(panel.getByText('Tào đang trả lời…')).toBeVisible();
    // Không tách thành bong bóng "Dòng 1" riêng.
    await expect(panel.getByText('Dòng 1', { exact: true })).toHaveCount(0);
    await expect(panel.getByText(/^Dòng 1\s+Dòng 2$/)).toHaveCount(1);
    await expect(panel.getByText('Tào đang trả lời…')).toHaveCount(0, { timeout: 15_000 });
    await expect(panel.getByText(/^Dòng 1\s+Dòng 2$/)).toHaveCount(1);
  });

  test('TC-CHATBOT-014 (CB-10-03): mã hỗ trợ vẫn hiện sau khi đóng / mở lại khung chat và sau F5', async ({ page }) => {
    await uiLogin(page, 'member2@sofinhub.test');
    const panel = await openWidget(page);
    await panel.getByRole('button', { name: 'Gặp người hỗ trợ' }).or(panel.getByRole('link', { name: 'Nhắn Zalo hỗ trợ' })).click();
    const banner = panel.getByText(/Mã hỗ trợ của bạn: T-\d+/);
    await expect(banner).toBeVisible();
    const code = (await banner.textContent())!.match(/T-\d+/)![0];
    await panel.getByRole('button', { name: 'Đóng' }).click();
    await page.getByRole('button', { name: 'Mở trợ lý hỗ trợ' }).click();
    await expect(panel.getByText(new RegExp(`Mã hỗ trợ của bạn: ${code}`))).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Mở trợ lý hỗ trợ' }).click();
    await expect(page.getByRole('dialog', { name: /trợ lý SofinHub/ }).getByText(new RegExp(`Mã hỗ trợ của bạn: ${code}`))).toBeVisible();
  });

  test('TC-CHATBOT-015 (CB-11-03): bấm "Cuộc mới" nhiều lần khi cuộc đang trống => không tạo thêm hội thoại rỗng', async ({ page }) => {
    await uiLogin(page, 'member1@sofinhub.test');
    const panel = await openWidget(page);
    await expect(panel.getByText(/Tào nghe đây/)).toBeVisible();
    let created = 0;
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/api\/chatbot\/conversations$/.test(r.url())) created += 1;
    });
    for (let i = 0; i < 5; i++) await panel.getByRole('button', { name: 'Cuộc mới' }).click();
    await page.waitForTimeout(500);
    expect(created).toBe(0);
  });

  test('TC-CHATBOT-016: gửi ảnh chụp lỗi kèm câu hỏi => ảnh hiện trong khung chat, Tào trả lời, F5 vẫn thấy ảnh', async ({ page }) => {
    const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
    await uiLogin(page, 'member1@sofinhub.test');
    const panel = await openWidget(page);
    await panel.locator('input[type=file]').setInputFiles({ name: 'loi.png', mimeType: 'image/png', buffer: PNG });
    // Upload xong => hiện lời nhắc (không gửi ảnh có mật khẩu/OTP), nút Gửi bấm được.
    await expect(panel.getByText(/Gửi ảnh chụp màn hình lỗi/)).toBeVisible();
    await ask(panel, 'lỗi này là sao');
    await expect(panel.getByRole('img', { name: 'Ảnh đã gửi' })).toHaveCount(1);
    await expect(panel.getByText('Tào đang trả lời…')).toHaveCount(0, { timeout: 15_000 });
    await expect(panel.getByRole('alert')).toHaveCount(0);
    await expect(panel.getByText('lỗi này là sao', { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Mở trợ lý hỗ trợ' }).click();
    await expect(page.getByRole('dialog', { name: /trợ lý SofinHub/ }).getByRole('img', { name: 'Ảnh đã gửi' })).toHaveCount(1);
  });

  test('TC-CHATBOT-006: admin xem trang Chatbot (kho mẫu, chờ duyệt, cài đặt)', async ({ page }) => {
    await uiLogin(page, 'admin@sofinhub.test');
    await page.goto('/admin/support/chatbot');
    await expect(page.getByRole('heading', { name: 'Chatbot hỗ trợ' })).toBeVisible();
    await expect(page.getByText('Tôi quên mật khẩu thì làm sao?')).toBeVisible();
    await page.getByRole('button', { name: /^Chờ duyệt/ }).click();
    await expect(page.getByText(/chỉ được bot dùng sau khi duyệt/)).toBeVisible();
    await page.getByRole('button', { name: 'Cài đặt' }).click();
    await expect(page.getByLabel('Link Zalo hỗ trợ')).toBeVisible();
  });
});
