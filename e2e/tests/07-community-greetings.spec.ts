import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { API_BASE, registerViaApi, snapEvidence, uniqueUser } from './helpers';

/**
 * Lời chào thành viên mới, thông báo popup dạng slide, giới hạn 5 bài ghim + Quản lý ghim, cấu hình nhân cách trợ lý
 * (docs/features/community-greetings.md, docs/features/chatbot-persona.md).
 * Backend: CHATBOT_FAKE_MODEL=1 ENABLE_DEV_OUTBOX=1 (đăng ký tài khoản mới qua OTP trong hộp thư dev); dữ liệu: npm run db:seed.
 * Lời chào chỉ hiện 1 lần / người => mỗi lần chạy dùng tài khoản MỚI; dữ liệu tạo ra (thông báo, bài ghim) được dọn ở cuối test.
 */
test.afterEach(async ({ page }, testInfo) => {
  await snapEvidence(page, testInfo);
});

const PW = 'Passw0rd!x';
const C = 'photo';
const stamp = () => `${Date.now().toString(36)}`;

async function token(request: APIRequestContext, email: string) {
  const r = await request.post(`${API_BASE}/auth/login`, { data: { email, password: PW } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return ((await r.json()) as { data: { accessToken: string } }).data.accessToken;
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

/** Thành viên mới của `photo` (đăng nhập sẵn trong context của `page`). */
async function newMember(page: Page, tag: string) {
  // Email tối đa 30 ký tự (uniqueUser() sinh email dài hơn) => email ngắn riêng.
  const u = await registerViaApi(page, { ...uniqueUser(tag), email: `${tag}${Date.now().toString(36)}@sofinhub.test` });
  const r = await page.request.post(`${API_BASE}/courses/${C}/enroll`, { headers: auth(u.accessToken) });
  expect(r.ok(), await r.text()).toBeTruthy();
  return u;
}

async function enableWelcome(request: APIRequestContext, owner: string) {
  const r = await request.put(`${API_BASE}/communities/${C}/greetings/welcome`, {
    headers: auth(owner),
    data: { enabled: true, message: 'Chào {ten}, mừng bạn đến với **{cong_dong}**!\n\nĐể bắt đầu:\n1. Đọc nội quy\n2. Giới thiệu bản thân' },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
}

type Pin = { id: string; title: string };
const pins = async (request: APIRequestContext, owner: string) =>
  ((await (await request.get(`${API_BASE}/communities/${C}/pins`, { headers: auth(owner) })).json()) as { data: { pins: Pin[] } }).data.pins;

test.describe('Lời chào, thông báo popup, giới hạn ghim, nhân cách', () => {
  test('TC-GRT-001: lời chào hiện đúng 1 lần cho thành viên mới; tải lại / rời rồi tham gia lại không hiện nữa', async ({ page }) => {
    await enableWelcome(page.request, await token(page.request, 'owner@sofinhub.test'));
    const u = await newMember(page, 'grt1');
    await page.goto(`/communities/${C}/community`);
    const popup = page.getByRole('dialog', { name: 'Lời chào thành viên mới' });
    await expect(popup).toBeVisible();
    await expect(popup.locator('header')).toContainText('Olivia Owner');
    await expect(popup.getByText('Chủ cộng đồng')).toBeVisible();
    await expect(popup.getByText(`Chào ${u.firstName}, mừng bạn đến với`)).toBeVisible();
    await expect(popup.locator('strong', { hasText: 'Nhiếp ảnh bằng điện thoại' })).toBeVisible();
    await expect(popup.getByRole('button', { name: 'Nhắn tin cho Olivia Owner' })).toBeVisible();
    await popup.getByRole('button', { name: /Bắt đầu thôi|Tiếp/ }).click();

    await page.reload();
    await expect(page.getByRole('heading', { name: /Chào mừng bạn trở lại/ })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Lời chào thành viên mới' })).toHaveCount(0);

    // Rời rồi tham gia lại.
    expect((await page.request.delete(`${API_BASE}/me/communities/${C}`, { headers: auth(u.accessToken) })).ok()).toBeTruthy();
    expect((await page.request.post(`${API_BASE}/courses/${C}/enroll`, { headers: auth(u.accessToken) })).ok()).toBeTruthy();
    await page.goto(`/communities/${C}/community`);
    await expect(page.getByRole('heading', { name: /Chào mừng bạn trở lại/ })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Lời chào thành viên mới' })).toHaveCount(0);
  });

  test('TC-GRT-002: thông báo đăng sau khi tham gia => slide cũ -> mới, mỗi slide 1 lần; ra trang khác rồi quay lại không hiện lại', async ({ page }) => {
    const owner = await token(page.request, 'owner@sofinhub.test');
    // Chừa 2 chỗ ghim: bỏ ghim tạm các bài thừa (ghi lại để ghim lại ở cuối).
    const unpinned: string[] = [];
    const s = stamp();
    const titles = [`E2E thông báo A ${s}`, `E2E thông báo B ${s}`];
    // Mọi bước đổi dữ liệu nằm trong try => lỗi giữa chừng vẫn được dọn ở finally.
    try {
      for (const p of (await pins(page.request, owner)).slice(3)) {
        await page.request.post(`${API_BASE}/posts/${p.id}/pin`, { headers: auth(owner) });
        unpinned.push(p.id);
      }
      await newMember(page, 'grt2');
      for (const title of titles) {
        const r = await page.request.post(`${API_BASE}/communities/${C}/greetings/announcements`, { headers: auth(owner), data: { title, body: `Nội dung **${title}**\n- ý 1\n- ý 2` } });
        expect(r.status(), await r.text()).toBe(201);
      }
      await page.goto(`/communities/${C}/community`);
      // Lời chào là slide đầu (thành viên mới), rồi tới 2 thông báo theo thứ tự cũ -> mới.
      const welcome = page.getByRole('dialog', { name: 'Lời chào thành viên mới' });
      await expect(page.getByRole('dialog')).toBeVisible();
      if (await welcome.count()) await welcome.getByRole('button', { name: 'Tiếp', exact: true }).last().click();
      const a = page.getByRole('dialog', { name: titles[0] });
      await expect(a).toBeVisible();
      await expect(a.getByText('1/2')).toBeVisible();
      await expect(a.getByRole('link', { name: 'Xem chi tiết' })).toHaveAttribute('href', /\/community\?post=/);
      await a.getByRole('button', { name: 'Tiếp', exact: true }).last().click();
      const b = page.getByRole('dialog', { name: titles[1] });
      await expect(b.getByText('2/2')).toBeVisible();
      await b.getByRole('button', { name: 'Đã hiểu' }).click();

      // Bài thông báo nằm ghim trên Bảng tin.
      await expect(page.locator('article', { hasText: titles[1] }).getByText('Đã ghim')).toBeVisible();

      await page.getByRole('link', { name: 'Cộng đồng của tôi' }).first().click();
      await expect(page).toHaveURL(/\/me\/communities/);
      await page.goBack();
      await expect(page.getByRole('heading', { name: /Chào mừng bạn trở lại/ })).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    } finally {
      // Dọn: xóa 2 bài thông báo E2E (thông báo bị xóa theo), ghim lại các bài đã tạm bỏ ghim.
      for (const p of await pins(page.request, owner)) if (titles.includes(p.title)) await page.request.delete(`${API_BASE}/posts/${p.id}`, { headers: auth(owner) });
      for (const id of unpinned) await page.request.post(`${API_BASE}/posts/${id}/pin`, { headers: auth(owner) });
    }
  });

  test('TC-GRT-003: đủ 5 bài ghim => ghim thêm mở hộp Quản lý bài ghim; bỏ ghim 1 bài rồi ghim được', async ({ page }) => {
    const owner = await token(page.request, 'owner@sofinhub.test');
    const s = stamp();
    const created: string[] = [];
    const mk = async (content: string) => {
      const r = await page.request.post(`${API_BASE}/courses/${C}/posts`, { headers: auth(owner), data: { content } });
      expect(r.status(), await r.text()).toBe(201);
      const id = ((await r.json()) as { data: { id: string } }).data.id;
      created.push(id);
      return id;
    };
    test.setTimeout(60_000);
    // Bài đang ghim lúc bắt đầu => cuối test ghim lại đúng danh sách này (kể cả khi test lỗi giữa chừng).
    const original = (await pins(page.request, owner)).map((p) => p.id);
    try {
      // Luôn có ít nhất 1 bài ghim TẠM (để bỏ ghim trong hộp mà không đụng bài thật): đủ 5 thì tạm bỏ ghim 1 bài thật.
      if (original.length >= 5) await page.request.post(`${API_BASE}/posts/${original.at(-1)}/pin`, { headers: auth(owner) });
      while ((await pins(page.request, owner)).length < 5) await page.request.post(`${API_BASE}/posts/${await mk(`E2E ghim tạm ${s}-${created.length}`)}/pin`, { headers: auth(owner) });
      const target = await mk(`E2E bài muốn ghim ${s}`);

      await page.request.post(`${API_BASE}/auth/login`, { data: { email: 'owner@sofinhub.test', password: PW } });
      await page.goto(`/communities/${C}/community?post=${target}`);
      const card = page.locator(`#post-${target}`).first();
      await card.getByRole('button', { name: 'Thêm tùy chọn' }).click();
      await page.getByRole('menuitem', { name: /Ghim bài/ }).click();

      const modal = page.getByRole('dialog', { name: 'Quản lý bài ghim' });
      await expect(modal).toBeVisible();
      await expect(modal.getByText('Đang ghim 5/5 bài')).toBeVisible();
      await expect(modal.getByText(/Cộng đồng đã ghim đủ 5 bài/)).toBeVisible();
      const retry = modal.getByRole('button', { name: 'Ghim bài này' });
      await expect(retry).toBeDisabled();

      // Bỏ ghim 1 bài tạm.
      await modal.locator('div.rounded-2xl', { hasText: `E2E ghim tạm ${s}` }).first().getByRole('button', { name: 'Bỏ ghim' }).click();
      await expect(modal.getByText('Đang ghim 4/5 bài')).toBeVisible();
      await expect(retry).toBeEnabled();
      await retry.click();
      await expect(modal).toHaveCount(0);
      expect((await pins(page.request, owner)).some((p) => p.id === target)).toBeTruthy();

      // Nút "Quản lý ghim" trên Bảng tin (mod trở lên).
      await page.getByRole('button', { name: 'Quản lý ghim' }).click();
      await expect(page.getByRole('dialog', { name: 'Quản lý bài ghim' }).getByText('Đang ghim 5/5 bài')).toBeVisible();
      await page.getByRole('dialog', { name: 'Quản lý bài ghim' }).getByRole('button', { name: 'Xong' }).click();
    } finally {
      for (const id of created) await page.request.delete(`${API_BASE}/posts/${id}`, { headers: auth(owner) });
      const now = new Set((await pins(page.request, owner)).map((p) => p.id));
      for (const id of original) if (!now.has(id)) await page.request.post(`${API_BASE}/posts/${id}/pin`, { headers: auth(owner) });
    }
  });

  test('TC-GRT-004: thành viên thường không thấy "Quản lý ghim"; chủ xem trước nhân cách và tùy chỉnh từ mẫu (không lưu)', async ({ page }) => {
    await page.request.post(`${API_BASE}/auth/login`, { data: { email: 'member2@sofinhub.test', password: PW } });
    await page.goto(`/communities/${C}/community`);
    await expect(page.getByRole('heading', { name: /Chào mừng bạn trở lại/ })).toBeVisible();
    const anyPopup = page.getByRole('dialog');
    for (let i = 0; i < 5 && (await anyPopup.count()); i++) await anyPopup.first().getByRole('button', { name: 'Đóng' }).click();
    await expect(page.getByRole('button', { name: 'Quản lý ghim' })).toHaveCount(0);

    await page.request.post(`${API_BASE}/auth/login`, { data: { email: 'owner@sofinhub.test', password: PW } });
    await page.goto('/communities/paid-demo/community/cai-dat?tab=chatbot');
    await page.getByRole('radio', { name: /Trợ lý lễ phép/ }).click();
    await expect(page.getByRole('radio', { name: /Trợ lý lễ phép/ })).toContainText('Hợp với:');
    await page.getByRole('button', { name: 'Xem trợ lý được dặn gì' }).click();
    const preview = page.locator('pre', { hasText: 'nhân cách: Trợ lý lễ phép' });
    await expect(preview).toContainText('tự xưng "em", gọi người hỏi là "anh/chị"');
    await expect(preview).toContainText('Cách xử lý tình huống:');
    await expect(preview).not.toContainText('Hợp với');

    await page.getByRole('button', { name: 'Tùy chỉnh từ mẫu “Trợ lý lễ phép”' }).click();
    await expect(page.getByText('Nhân cách tự tạo')).toBeVisible();
    await expect(page.locator('input[value="Trợ lý lễ phép (tùy chỉnh)"]')).toBeVisible();
    await expect(page.getByText('Cách xử lý từng tình huống')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Gợi ý trước' })).toBeVisible();
  });
});
