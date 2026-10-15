import { expect, test, type Page } from '@playwright/test';
import { API_BASE, snapEvidence } from './helpers';

/**
 * Trợ lý AI riêng của cộng đồng (chatbot.md). Backend chạy model giả: CHATBOT_FAKE_MODEL=1 npm run dev; dữ liệu: npm run db:seed
 * (prisma/seed/community-bot.ts: paid-demo = có phí, member1 VIP; photo = miễn phí, member2 thường; yt = không bật bot).
 */
test.afterEach(async ({ page }, testInfo) => {
  await snapEvidence(page, testInfo);
});

const PW = 'Passw0rd!x';

async function uiLogin(page: Page, email: string) {
  const r = await page.request.post(`${API_BASE}/auth/login`, { data: { email, password: PW } });
  expect(r.ok(), await r.text()).toBeTruthy();
}

async function openBot(page: Page, community: string, botName: string) {
  await page.goto(`/communities/${community}/community`);
  await page.getByRole('button', { name: `Mở trợ lý ${botName}` }).click();
  const panel = page.getByRole('dialog', { name: botName });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Cuộc mới' }).click();
  return panel;
}

const ask = async (panel: ReturnType<Page['getByRole']>, text: string) => {
  await panel.getByLabel('Nhập câu hỏi…').fill(text);
  await panel.getByRole('button', { name: 'Gửi' }).click();
};

test.describe('Trợ lý AI của cộng đồng', () => {
  test('TC-CBOT-001: thành viên VIP đổi nhân cách, hỏi câu mẫu của cộng đồng, gửi câu hỏi cho chủ', async ({ page }) => {
    await uiLogin(page, 'member1@sofinhub.test');
    const panel = await openBot(page, 'paid-demo', 'Trợ lý Paid Demo');
    // Trợ lý Tào bị ẩn trong trang cộng đồng có bot riêng.
    await expect(page.getByRole('button', { name: 'Mở trợ lý hỗ trợ' })).toHaveCount(0);

    await panel.getByRole('button', { name: /Nhân cách:/ }).click();
    await panel.getByRole('menuitemradio', { name: 'Bạn đồng hành vui vẻ' }).click();
    await expect(panel.getByRole('button', { name: /Nhân cách: Bạn đồng hành vui vẻ/ })).toBeVisible();

    await ask(panel, 'khi nào có buổi live');
    await expect(panel.getByText(/20:00 tối thứ Năm hằng tuần/)).toBeVisible();

    await ask(panel, 'cho mình gặp chủ cộng đồng hỏi riêng');
    await panel.getByRole('button', { name: /Gửi câu hỏi cho chủ cộng đồng/ }).click();
    await expect(panel.getByText('Đã gửi câu hỏi cho chủ cộng đồng qua Tin nhắn.')).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Mở Tin nhắn' })).toHaveAttribute('href', '/messages');

    // Đặt lại nhân cách mặc định cho lần chạy sau.
    await panel.getByRole('button', { name: /Nhân cách:/ }).click();
    await panel.getByRole('menuitemradio', { name: 'Thầy/cô tận tâm' }).click();
  });

  test('TC-CBOT-002: thành viên thường chat được nhưng nhân cách bị khóa; cộng đồng miễn phí không có dải nâng cấp', async ({ page }) => {
    await uiLogin(page, 'member2@sofinhub.test');
    const panel = await openBot(page, 'photo', 'Trợ lý Nhiếp ảnh');
    await expect(panel.getByText('Chủ cộng đồng có thể xem nội dung trò chuyện với trợ lý.')).toBeVisible();
    await expect(panel.getByRole('link', { name: /Nâng cấp VIP/ })).toHaveCount(0);
    await panel.getByRole('button', { name: 'Nhân cách: Bạn đồng hành vui vẻ' }).click();
    await expect(panel.getByRole('menuitemradio', { name: /Thầy\/cô tận tâm/ })).toBeDisabled();
    await expect(panel.getByText(/Nâng cấp VIP \(thành viên trả phí\) để chọn nhân cách/)).toBeVisible();
    await ask(panel, 'nội quy cộng đồng là gì');
    await expect(panel.getByRole('button', { name: 'Câu trả lời hữu ích' }).last()).toBeVisible();
  });

  test('TC-CBOT-003: cộng đồng không bật bot => vẫn có trợ lý Tào', async ({ page }) => {
    await uiLogin(page, 'member1@sofinhub.test');
    await page.goto('/communities/yt/community');
    await expect(page.getByRole('button', { name: 'Mở trợ lý hỗ trợ' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Mở trợ lý Trợ lý/ })).toHaveCount(0);
  });

  test('TC-CBOT-004: chủ cộng đồng mở tab Trợ lý AI trong Cài đặt', async ({ page }) => {
    await uiLogin(page, 'owner@sofinhub.test');
    await page.goto('/communities/paid-demo/community/cai-dat?tab=chatbot');
    await expect(page.getByRole('heading', { name: 'Trợ lý AI của cộng đồng' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Huấn luyện viên thẳng thắn/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Thầy\/cô tận tâm/ })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('Lịch học live của cộng đồng là khi nào?')).toBeVisible();
  });
});
