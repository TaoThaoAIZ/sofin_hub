import { expect, test, type Page } from '@playwright/test';
import { API_BASE, snapEvidence } from './helpers';

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
    await expect(panel.getByText(/Quên mật khẩu" và nhập email/)).toBeVisible();
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
