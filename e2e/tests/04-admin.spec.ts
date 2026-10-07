import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { API_BASE, snapEvidence } from './helpers';

/**
 * Sheet ADMIN - Quản trị & Kiểm duyệt. Chạy trên DB đã `npm run db:seed` (create-only) với BE bật ENABLE_DEV_OUTBOX=1 và RATE_LIMIT_DISABLED=1.
 * Phần lớn case là kiểm API (đúng như bước trong sheet); các case giao diện chạy trên trình duyệt thật.
 * Tên mỗi test bắt đầu bằng mã TC để script gom kết quả. Chạy tuần tự vì các case dùng chung dữ liệu seed.
 */
test.describe.configure({ mode: 'default' });
test.afterEach(async ({ page }, testInfo) => {
  await snapEvidence(page, testInfo);
});

const PW = 'Passw0rd!x';
const email = (k: string) => `${k}@sofinhub.test`;
const SEEDED = ['admin', 'owner', 'cadmin', 'mod', 'member1', 'member2', 'member3', 'newbie', 'banned'] as const;
type Key = (typeof SEEDED)[number];
const tok: Record<string, string> = {};
const uid: Record<string, string> = {};
const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface Res {
  status: number;
  body: any;
}
async function call(request: APIRequestContext, method: string, path: string, token?: string, data?: unknown): Promise<Res> {
  const r = await request.fetch(API_BASE + path, { method, headers: token ? { Authorization: `Bearer ${token}` } : {}, data });
  let body: any = null;
  try {
    body = await r.json();
  } catch {
    /* không có body */
  }
  return { status: r.status(), body };
}
const msg = (r: Res) => r.body?.error?.message as string | undefined;
const code = (r: Res) => r.body?.error?.code as string | undefined;

async function login(request: APIRequestContext, e: string, password = PW) {
  const r = await call(request, 'POST', '/auth/login', undefined, { email: e, password });
  expect(r.status, `login ${e}: ${JSON.stringify(r.body)}`).toBe(200);
  return { token: r.body.data.accessToken as string, id: r.body.data.user.id as string };
}

/** Đăng ký user mới (OTP đọc từ /dev/outbox) rồi trả token + id. */
async function newUser(request: APIRequestContext, tag: string) {
  const mail = `qa.${tag}.${uniq()}@sofinhub.test`;
  const reg = await call(request, 'POST', '/auth/register', undefined, { email: mail, password: PW, firstName: 'QA', lastName: tag });
  expect(reg.status, JSON.stringify(reg.body)).toBeLessThan(300);
  const box = await call(request, 'GET', `/dev/outbox?to=${encodeURIComponent(mail)}`);
  const otp = (box.body.data as { subject: string }[]).map((m) => m.subject.match(/\b(\d{6})\b/)?.[1]).filter(Boolean).at(-1)!;
  const v = await call(request, 'POST', '/auth/register/verify', undefined, { email: mail, code: otp });
  expect(v.status, JSON.stringify(v.body)).toBe(200);
  return { email: mail, token: v.body.data.accessToken as string, id: v.body.data.user.id as string };
}

async function mkPost(request: APIRequestContext, token: string, content = `QA post ${uniq()}`) {
  const r = await call(request, 'POST', '/courses/photo/posts', token, { content });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.data.id as string;
}
const reportPost = (request: APIRequestContext, token: string, postId: string, reason = 'spam', detail?: string) =>
  call(request, 'POST', `/posts/${postId}/report`, token, { reason, ...(detail !== undefined ? { detail } : {}) });
const reportMember = (request: APIRequestContext, token: string, userId: string, reason = 'spam') =>
  call(request, 'POST', `/courses/photo/members/${userId}/report`, token, { reason });
/** Bài mới của member1 + báo cáo spam của member2 (tránh dùng lại báo cáo seed). */
async function freshReport(request: APIRequestContext) {
  const postId = await mkPost(request, tok.member1!);
  const r = await reportPost(request, tok.member2!, postId);
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return { postId, reportId: r.body.data.id as string };
}
const queue = (request: APIRequestContext, token: string, qs = '') => call(request, 'GET', `/courses/photo/reports${qs}`, token);
const resolve = (request: APIRequestContext, token: string | undefined, id: string, body: object) => call(request, 'PATCH', `/reports/${id}`, token, body);
const notifs = async (request: APIRequestContext, token: string) => (await call(request, 'GET', '/notifications', token)).body?.data as any[];

/** Đăng nhập trình duyệt: gọi API login (cookie refresh nằm trong context) rồi tải trang → AuthProvider tự refresh. */
async function uiLogin(page: Page, key: string) {
  const r = await page.request.post(`${API_BASE}/auth/login`, { data: { email: email(key), password: PW } });
  expect(r.ok(), await r.text()).toBeTruthy();
  await page.goto('/');
}

test.beforeAll(async ({ request }) => {
  for (const k of SEEDED) {
    const r = await login(request, email(k));
    tok[k] = r.token;
    uid[k] = r.id;
  }
});

/* ============================================================== Báo cáo vi phạm */
test.describe('Báo cáo vi phạm', () => {
  test('TC-ADMIN-013: Member báo cáo bài viết → 201, open, kèm ảnh chụp nội dung', async ({ request }) => {
    const r = await reportPost(request, tok.member2!, 'seed-post-photo-m1-image');
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const d = r.body.data;
    expect(d).toMatchObject({ status: 'open', targetType: 'post', targetId: 'seed-post-photo-m1-image', reason: 'spam', reporterName: 'Mai Member2', targetUserName: 'Minh Member1' });
    expect(d.targetExcerpt).toMatch(/^Mình vừa chụp bộ ảnh hoàng hôn ở Đà Nẵng/);
    const q = await queue(request, tok.mod!, '?status=open');
    expect(q.status).toBe(200);
    const ids = (q.body.data as any[]).map((x) => x.id);
    expect(ids).toContain(d.id);
    expect(ids).toContain('seed-report-photo-open');
    expect(q.body.meta.total).toBeGreaterThanOrEqual(2);
  });

  test('TC-ADMIN-014: Member báo cáo bình luận → 201, targetType=comment', async ({ request }) => {
    const r = await call(request, 'POST', '/comments/seed-comment-photo-m2-on-m1-image/report', tok.member3, { reason: 'harassment' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data).toMatchObject({ targetType: 'comment', targetId: 'seed-comment-photo-m2-on-m1-image', targetUserName: 'Mai Member2', reason: 'harassment', status: 'open', targetExcerpt: 'Bố cục đẹp quá, màu trời rất có hồn!' });
  });

  test('TC-ADMIN-015: Member báo cáo thành viên cùng cộng đồng → 201, không có targetExcerpt', async ({ request }) => {
    const r = await reportMember(request, tok.member2!, uid.member3!);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data).toMatchObject({ targetType: 'member', targetId: uid.member3, targetUserName: 'Manh Member3', status: 'open' });
    expect(r.body.data.targetExcerpt ?? null).toBeNull();
  });

  test('TC-ADMIN-016: Báo cáo trùng cùng người + cùng đối tượng → 409', async ({ request }) => {
    const r = await reportPost(request, tok.member3!, 'seed-post-photo-m1-image', 'other');
    expect(r.status).toBe(409);
    expect(code(r)).toBe('CONFLICT');
    expect(msg(r)).toBe('Bạn đã báo cáo mục này rồi');
    const q = await queue(request, tok.mod!, '?status=open&limit=50');
    const mine = (q.body.data as any[]).filter((x) => x.targetId === 'seed-post-photo-m1-image' && x.reporterName === 'Manh Member3');
    expect(mine).toHaveLength(1);
  });

  test('TC-ADMIN-017: Không báo cáo được bài viết của chính mình → 400', async ({ request }) => {
    const r = await reportPost(request, tok.member1!, 'seed-post-photo-m1-image');
    expect(r.status).toBe(400);
    expect(code(r)).toBe('BAD_REQUEST');
    expect(msg(r)).toBe('Bạn không thể báo cáo chính mình hoặc nội dung của mình');
  });

  test('TC-ADMIN-018: Không báo cáo được bình luận của chính mình → 400', async ({ request }) => {
    const r = await call(request, 'POST', '/comments/seed-comment-photo-m2-on-m1-image/report', tok.member2, { reason: 'spam' });
    expect(r.status).toBe(400);
    expect(msg(r)).toBe('Bạn không thể báo cáo chính mình hoặc nội dung của mình');
  });

  test('TC-ADMIN-019: Không tự báo cáo chính mình (API 400; UI không có mục báo cáo ở menu của mình)', async ({ request, page }) => {
    const me = await call(request, 'GET', '/auth/me', tok.member2);
    const r = await reportMember(request, tok.member2!, me.body.data.id);
    expect(r.status).toBe(400);
    expect(msg(r)).toBe('Bạn không thể báo cáo chính mình hoặc nội dung của mình');
    await uiLogin(page, 'member2');
    await page.goto('/communities/photo/community/thanh-vien');
    await expect(page.getByText('Mai Member2').first()).toBeVisible();
    const reportItems = page.getByRole('menuitem', { name: 'Báo cáo thành viên' });
    // Mở menu "…" của dòng chính mình (nếu có) và đảm bảo không có mục báo cáo.
    const ownRow = page.locator('li, tr, div').filter({ hasText: 'Mai Member2' }).filter({ has: page.getByRole('button', { name: /…|⋯|more|thao tác/i }) }).first();
    if (await ownRow.count()) {
      await ownRow.getByRole('button', { name: /…|⋯|more|thao tác/i }).first().click();
      await expect(reportItems).toHaveCount(0);
    }
  });

  test('TC-ADMIN-020: Validate lý do: reason ngoài danh sách / thiếu / sai hoa-thường → 400', async ({ request }) => {
    const id = 'seed-post-photo-m1-image';
    for (const body of [{ reason: 'abc' }, {}, { reason: 'SPAM' }]) {
      const r = await call(request, 'POST', `/posts/${id}/report`, tok.member2, body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(code(r)).toBe('VALIDATION_ERROR');
      expect(msg(r)).toBe('Tham số không hợp lệ');
      expect(JSON.stringify(r.body.error.details.fieldErrors.reason)).toContain('Lý do báo cáo không hợp lệ');
    }
  });

  test('TC-ADMIN-021: Biên độ detail: 1001 ký tự → 400, 1000 ký tự → 201', async ({ request }) => {
    const postId = await mkPost(request, tok.member1!);
    expect((await reportPost(request, tok.member2!, postId, 'spam', 'x'.repeat(1001))).status).toBe(400);
    const ok = await reportPost(request, tok.member2!, postId, 'spam', 'x'.repeat(1000));
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    const blank = await mkPost(request, tok.member1!);
    expect((await reportPost(request, tok.member2!, blank, 'spam', '   ')).status).toBe(201);
  });

  test('TC-ADMIN-022: Đủ 5 lý do hợp lệ; hộp thoại UI hiện 5 nhãn tiếng Việt', async ({ request, page }) => {
    const postId = await mkPost(request, tok.member1!);
    const reasons = ['spam', 'harassment', 'inappropriate', 'misinformation', 'other'];
    for (const [i, reason] of reasons.entries()) {
      const u = await newUser(request, `rep${i}`);
      const en = await call(request, 'POST', '/courses/photo/enroll', u.token);
      expect(en.status, JSON.stringify(en.body)).toBeLessThan(300);
      const r = await reportPost(request, u.token, postId, reason);
      expect(r.status, `${reason}: ${JSON.stringify(r.body)}`).toBe(201);
    }
    const q = await queue(request, tok.mod!, '?status=open&limit=50');
    const got = (q.body.data as any[]).filter((x) => x.targetId === postId).map((x) => x.reason).sort();
    expect(got).toEqual([...reasons].sort());
    // UI: mở hộp thoại báo cáo bài viết của người khác.
    await uiLogin(page, 'member3');
    await page.goto('/communities/photo/community');
    const card = page.locator('article').filter({ hasText: 'Minh Member1' }).first();
    await card.getByRole('button', { name: /thêm|more|…|⋯/i }).last().click();
    await page.getByRole('menuitem', { name: 'Báo cáo' }).click();
    for (const label of ['Spam', 'Quấy rối', 'Không phù hợp', 'Sai lệch', 'Khác']) {
      await expect(page.getByText(new RegExp(label, 'i')).first()).toBeVisible();
    }
  });

  test('TC-ADMIN-023: Phân quyền tạo báo cáo: khách 401, người ngoài 403, bị ban 403', async ({ request }) => {
    const id = 'seed-post-photo-m1-image';
    const g = await reportPost(request, undefined as any, id);
    expect(g.status).toBe(401);
    expect(msg(g)).toBe('Vui lòng đăng nhập để tiếp tục');
    for (const k of ['newbie', 'banned']) {
      const r = await reportPost(request, tok[k]!, id);
      expect(r.status, k).toBe(403);
      expect(msg(r)).toBe('Bạn cần tham gia cộng đồng này trước');
    }
  });

  test('TC-ADMIN-024: Báo cáo bài không tồn tại / bài bị ẩn → 404; mod báo cáo bài ẩn → 201', async ({ request }) => {
    for (const id of ['khong-ton-tai', 'seed-post-photo-m1-hidden']) {
      const r = await reportPost(request, tok.member3!, id);
      expect(r.status, id).toBe(404);
      expect(msg(r)).toBe('Không tìm thấy bài viết');
    }
    expect((await reportPost(request, tok.mod!, 'seed-post-photo-m1-hidden')).status).toBe(201);
  });

  test('TC-ADMIN-025: Báo cáo thành viên không thuộc cộng đồng → 404', async ({ request }) => {
    for (const id of [uid.newbie!, 'id-linh-tinh']) {
      const r = await reportMember(request, tok.member2!, id);
      expect(r.status, id).toBe(404);
      expect(msg(r)).toBe('Không tìm thấy thành viên');
    }
  });

  test('TC-ADMIN-026: targetExcerpt rút gọn 120 ký tự và kết thúc bằng …', async ({ request }) => {
    const postId = await mkPost(request, tok.member1!, 'x'.repeat(300));
    const r = await reportPost(request, tok.member2!, postId);
    expect(r.status).toBe(201);
    const ex = r.body.data.targetExcerpt as string;
    expect(ex).toHaveLength(120);
    expect(ex.endsWith('…')).toBe(true);
  });

  test('TC-ADMIN-027: Ảnh chụp nội dung không đổi khi tác giả sửa bài', async ({ request }) => {
    const postId = await mkPost(request, tok.member1!, 'Nội dung gốc');
    const r = await reportPost(request, tok.member2!, postId);
    expect(r.status).toBe(201);
    const ed = await call(request, 'PATCH', `/posts/${postId}`, tok.member1, { content: 'Đã sửa hoàn toàn' });
    expect(ed.status, JSON.stringify(ed.body)).toBe(200);
    const q = await queue(request, tok.mod!, '?status=open&limit=50');
    const rep = (q.body.data as any[]).find((x) => x.id === r.body.data.id);
    expect(rep.targetExcerpt).toBe('Nội dung gốc');
  });

  test('TC-ADMIN-028: Hai request báo cáo song song cùng người/đối tượng → 1 cái 201, 1 cái 409', async ({ request }) => {
    const postId = await mkPost(request, tok.member1!);
    const [a, b] = await Promise.all([reportPost(request, tok.member2!, postId), reportPost(request, tok.member2!, postId)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(msg(loser)).toBe('Bạn đã báo cáo mục này rồi');
    const q = await queue(request, tok.mod!, '?status=open&limit=50');
    expect((q.body.data as any[]).filter((x) => x.targetId === postId && x.reporterName === 'Mai Member2')).toHaveLength(1);
  });
});

/* ============================================================== Hàng đợi báo cáo */
test.describe('Hàng đợi báo cáo', () => {
  test('TC-ADMIN-029: Mod xem hàng đợi photo: đủ báo cáo seed (open + resolved/hide_content)', async ({ request }) => {
    const r = await queue(request, tok.mod!);
    expect(r.status).toBe(200);
    expect(r.body.meta).toMatchObject({ page: 1, limit: 20 });
    expect(r.body.meta.total).toBeGreaterThanOrEqual(2);
    const byId = Object.fromEntries((r.body.data as any[]).map((x) => [x.id, x]));
    const all = await queue(request, tok.mod!, '?limit=50');
    const ids = Object.fromEntries((all.body.data as any[]).map((x) => [x.id, x]));
    expect(ids['seed-report-photo-open']?.status).toBe('open');
    expect(ids['seed-report-photo-resolved']).toMatchObject({ status: 'resolved', action: 'hide_content' });
    const times = (r.body.data as any[]).map((x) => Date.parse(x.createdAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    void byId;
  });

  test('TC-ADMIN-030: Lọc resolved: báo cáo seed có ghi chú + người xử lý là mod', async ({ request }) => {
    const r = await queue(request, tok.mod!, '?status=resolved&limit=50');
    expect(r.status).toBe(200);
    expect((r.body.data as any[]).every((x) => x.status === 'resolved')).toBe(true);
    const s = (r.body.data as any[]).find((x) => x.id === 'seed-report-photo-resolved');
    expect(s).toMatchObject({ action: 'hide_content', note: 'Đã ẩn bài quảng cáo.', resolvedBy: uid.mod });
    expect(s.resolvedAt).toBeTruthy();
    expect(s.targetExcerpt).toMatch(/^Mua ngay khóa học chụp ảnh giá rẻ/);
  });

  test('TC-ADMIN-031: Tham số lỗi → 400 (status lạ, limit>50, page=0); limit=50 → 200', async ({ request }) => {
    for (const qs of ['?status=abc', '?limit=51', '?page=0']) {
      const r = await queue(request, tok.mod!, qs);
      expect(r.status, qs).toBe(400);
      expect(code(r)).toBe('VALIDATION_ERROR');
      expect(msg(r)).toBe('Tham số không hợp lệ');
    }
    const ok = await queue(request, tok.mod!, '?limit=50');
    expect(ok.status).toBe(200);
    expect(ok.body.meta.limit).toBe(50);
  });

  test('TC-ADMIN-032: Chỉ mod trở lên xem hàng đợi: member 403, mod/cadmin/owner 200, khách 401', async ({ request }) => {
    const m = await queue(request, tok.member1!);
    expect(m.status).toBe(403);
    expect(msg(m)).toBe('Bạn không có quyền thực hiện thao tác này trong cộng đồng');
    for (const k of ['mod', 'cadmin', 'owner']) expect((await queue(request, tok[k]!)).status, k).toBe(200);
    const g = await queue(request, undefined as any);
    expect(g.status).toBe(401);
    expect(msg(g)).toBe('Vui lòng đăng nhập để tiếp tục');
  });

  test('TC-ADMIN-033: Platform Admin xem hàng đợi photo; cộng đồng không tồn tại → 404', async ({ request }) => {
    expect((await queue(request, tok.admin!)).status).toBe(200);
    const r = await call(request, 'GET', '/courses/khong-ton-tai/reports', tok.admin);
    expect(r.status).toBe(404);
    expect(code(r)).toBe('NOT_FOUND');
  });

  test('TC-ADMIN-034: GET /admin/reports chỉ Platform Admin', async ({ request }) => {
    const a = await call(request, 'GET', '/admin/reports', tok.admin);
    expect(a.status).toBe(200);
    expect(a.body.meta.total).toBeGreaterThanOrEqual(2);
    const open = await call(request, 'GET', '/admin/reports?status=open&limit=50', tok.admin);
    expect((open.body.data as any[]).map((x) => x.id)).toContain('seed-report-photo-open');
    for (const k of ['owner', 'mod']) {
      const r = await call(request, 'GET', '/admin/reports', tok[k]);
      expect(r.status, k).toBe(403);
      expect(msg(r)).toBe('Chỉ Platform Admin mới có quyền này');
    }
    const g = await call(request, 'GET', '/admin/reports');
    expect(g.status).toBe(401);
    expect(msg(g)).toBe('Vui lòng đăng nhập để tiếp tục');
  });

  test('TC-ADMIN-035: Phân trang không chồng lấn, mới nhất trước, totalPages đúng', async ({ request }) => {
    const p1 = await queue(request, tok.mod!, '?limit=2&page=1');
    const p2 = await queue(request, tok.mod!, '?limit=2&page=2');
    const a = (p1.body.data as any[]).map((x) => x.id);
    const b = (p2.body.data as any[]).map((x) => x.id);
    expect(a.filter((id) => b.includes(id))).toHaveLength(0);
    expect(p1.body.meta.totalPages).toBe(Math.ceil(p1.body.meta.total / 2));
    const all = await queue(request, tok.mod!, '?limit=50');
    expect(a[0]).toBe((all.body.data as any[])[0].id);
  });

  test('TC-ADMIN-036: UI kiểm duyệt: mod thấy mục "Kiểm duyệt", 4 tab và nút xử lý', async ({ page }) => {
    await uiLogin(page, 'mod');
    await page.goto('/courses/photo/community');
    await expect(page).toHaveURL(/communities\/photo\/community/);
    await page.getByRole('link', { name: 'Kiểm duyệt' }).first().click();
    await expect(page).toHaveURL(/kiem-duyet/);
    for (const tab of ['Đang chờ', 'Đã xử lý', 'Đã bỏ qua', 'Tất cả']) await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bỏ qua' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ẩn nội dung' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cấm thành viên' }).first()).toBeVisible();
    await expect(page.getByPlaceholder('Ghi chú xử lý (không bắt buộc)').first()).toBeVisible();
    for (const tab of ['Đã xử lý', 'Đã bỏ qua', 'Tất cả']) {
      await page.getByRole('tab', { name: tab }).click();
    }
  });

  test('TC-ADMIN-037: UI: member không thấy mục Kiểm duyệt; vào thẳng URL bị chặn', async ({ page }) => {
    await uiLogin(page, 'member1');
    await page.goto('/communities/photo/community');
    await expect(page.getByRole('link', { name: 'Lớp học' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Kiểm duyệt' })).toHaveCount(0);
    await page.goto('/communities/photo/community/kiem-duyet');
    await expect(page.getByText('Chỉ dành cho quản trị viên')).toBeVisible();
  });
});

/* ============================================================== Xử lý báo cáo */
test.describe('Xử lý báo cáo', () => {
  test('TC-ADMIN-038: Mod Bỏ qua → dismissed, nội dung giữ nguyên, người báo cáo nhận thông báo', async ({ request }) => {
    const { postId, reportId } = await freshReport(request);
    const r = await resolve(request, tok.mod, reportId, { action: 'dismiss', note: 'Không vi phạm' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({ status: 'dismissed', action: 'dismiss', note: 'Không vi phạm', resolvedBy: uid.mod });
    expect(r.body.data.resolvedAt).toBeTruthy();
    const n = (await notifs(request, tok.member2!)).find((x) => x.type === 'report_resolved' && /không vi phạm/.test(x.body));
    expect(n?.title).toBe('Báo cáo của bạn đã được xử lý');
    expect(n?.body).toBe('Báo cáo của bạn được xác định là không vi phạm và đã được bỏ qua.');
    expect((await call(request, 'GET', `/posts/${postId}`, tok.member3)).status).toBe(200);
  });

  test('TC-ADMIN-039: Mod ẩn bài (hide_content): member không thấy; tác giả và mod vẫn thấy', async ({ request }) => {
    const { postId, reportId } = await freshReport(request);
    const r = await resolve(request, tok.mod, reportId, { action: 'hide_content' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({ status: 'resolved', action: 'hide_content' });
    const m3 = await call(request, 'GET', `/posts/${postId}`, tok.member3);
    expect(m3.status).toBe(404);
    expect(msg(m3)).toBe('Không tìm thấy bài viết');
    const feed = await call(request, 'GET', '/courses/photo/posts?limit=50', tok.member3);
    expect((feed.body.data as any[]).map((p) => p.id)).not.toContain(postId);
    for (const k of ['member1', 'mod']) {
      const v = await call(request, 'GET', `/posts/${postId}`, tok[k]);
      expect(v.status, k).toBe(200);
      expect(v.body.data.hidden).toBe(true);
    }
    expect((await notifs(request, tok.member2!)).some((x) => x.type === 'report_resolved' && /nội dung đã bị ẩn/.test(x.body))).toBe(true);
  });

  test('TC-ADMIN-040: Mod ẩn bình luận bị báo cáo: member thường không còn thấy', async ({ request }) => {
    const postId = await mkPost(request, tok.member1!);
    const c = await call(request, 'POST', `/posts/${postId}/comments`, tok.member2, { content: 'Bình luận cần ẩn' });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    const rep = await call(request, 'POST', `/comments/${c.body.data.id}/report`, tok.member3, { reason: 'spam' });
    expect(rep.status).toBe(201);
    const r = await resolve(request, tok.mod, rep.body.data.id, { action: 'hide_content' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const list = (k: string) => call(request, 'GET', `/posts/${postId}/comments`, tok[k]);
    expect(((await list('member1')).body.data as any[]).map((x) => x.id)).not.toContain(c.body.data.id);
    for (const k of ['mod', 'member2']) expect(((await list(k)).body.data as any[]).map((x) => x.id), k).toContain(c.body.data.id);
  });

  test('TC-ADMIN-041: Ẩn nội dung với báo cáo thành viên → 400, báo cáo vẫn open', async ({ request }) => {
    const rep = await reportMember(request, tok.member3!, uid.member1!);
    expect(rep.status, JSON.stringify(rep.body)).toBe(201);
    const r = await resolve(request, tok.mod, rep.body.data.id, { action: 'hide_content' });
    expect(r.status).toBe(400);
    expect(msg(r)).toBe('Chỉ ẩn được bài viết hoặc bình luận');
    const q = await queue(request, tok.mod!, '?status=open&limit=50');
    expect((q.body.data as any[]).find((x) => x.id === rep.body.data.id)?.status).toBe('open');
  });

  let victim: { email: string; token: string; id: string };
  test('TC-ADMIN-042: Ban qua báo cáo: bị cấm + xóa khỏi cộng đồng, ghi lý do + người cấm', async ({ request }) => {
    victim = await newUser(request, 'victim');
    expect((await call(request, 'POST', '/courses/photo/enroll', victim.token)).status).toBeLessThan(300);
    const postId = await mkPost(request, victim.token);
    const rep = await reportPost(request, tok.member2!, postId);
    expect(rep.status).toBe(201);
    const r = await resolve(request, tok.mod, rep.body.data.id, { action: 'ban_member', note: 'Spam lặp lại' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({ status: 'resolved', action: 'ban_member' });
    const x = await call(request, 'GET', '/courses/photo/posts', victim.token);
    expect(x.status).toBe(403);
    expect(msg(x)).toBe('Bạn cần tham gia cộng đồng này trước');
    const bans = await call(request, 'GET', '/courses/photo/bans', tok.owner);
    const ban = (bans.body.data as any[]).find((b) => b.userId === victim.id);
    expect(ban?.reason).toBe('Bị báo cáo (spam)');
    expect(ban?.bannedBy ?? ban?.bannedByName).toBeTruthy();
    expect((await notifs(request, tok.member2!)).some((n) => n.type === 'report_resolved' && /thành viên đã bị cấm/.test(n.body))).toBe(true);
  });

  test('TC-ADMIN-043: Mod không cấm được mod khác / admin: 403, báo cáo vẫn open', async ({ request }) => {
    const ids: string[] = [];
    for (const k of ['mod', 'cadmin']) {
      const rep = await reportMember(request, tok.member2!, uid[k]!);
      expect(rep.status, JSON.stringify(rep.body)).toBe(201);
      ids.push(rep.body.data.id);
    }
    for (const id of ids) {
      const r = await resolve(request, tok.mod, id, { action: 'ban_member' });
      expect(r.status).toBe(403);
      expect(msg(r)).toBe('Bạn không thể cấm người có vai trò ngang hoặc cao hơn mình');
    }
    const q = await queue(request, tok.mod!, '?status=open&limit=50');
    for (const id of ids) expect((q.body.data as any[]).find((x) => x.id === id)?.status).toBe('open');
  });

  test('TC-ADMIN-045: Không cấm thành viên minh họa (isDemo); dismiss vẫn được', async ({ request }) => {
    const demoId = 'demo-photo-1'; // thành viên minh họa của seed (isDemo)
    const rep = await reportMember(request, tok.member2!, demoId);
    expect(rep.status, JSON.stringify(rep.body)).toBe(201);
    const ban = await resolve(request, tok.mod, rep.body.data.id, { action: 'ban_member' });
    expect(ban.status).toBe(400);
    expect(msg(ban)).toBe('Không thể cấm nội dung minh họa');
    expect((await resolve(request, tok.mod, rep.body.data.id, { action: 'dismiss' })).status).toBe(200);
  });

  test('TC-ADMIN-046: Xử lý lại báo cáo đã xử lý → 409', async ({ request }) => {
    const r = await resolve(request, tok.mod, 'seed-report-photo-resolved', { action: 'dismiss' });
    expect(r.status).toBe(409);
    expect(code(r)).toBe('CONFLICT');
    expect(msg(r)).toBe('Báo cáo này đã được xử lý');
    const q = await queue(request, tok.mod!, '?status=resolved&limit=50');
    expect((q.body.data as any[]).find((x) => x.id === 'seed-report-photo-resolved')).toMatchObject({ status: 'resolved', action: 'hide_content' });
  });

  test('TC-ADMIN-047: Validate xử lý: action lạ, note 501, note 500 hợp lệ, báo cáo không tồn tại', async ({ request }) => {
    const { reportId } = await freshReport(request);
    const a = await resolve(request, tok.mod, reportId, { action: 'delete' });
    expect(a.status).toBe(400);
    expect(code(a)).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(a.body)).toContain('Hành động không hợp lệ');
    const b = await resolve(request, tok.mod, reportId, { action: 'dismiss', note: 'x'.repeat(501) });
    expect(b.status).toBe(400);
    expect(code(b)).toBe('VALIDATION_ERROR');
    expect((await resolve(request, tok.mod, reportId, { action: 'dismiss', note: 'x'.repeat(500) })).status).toBe(200);
    const d = await resolve(request, tok.mod, 'khong-co', { action: 'dismiss' });
    expect(d.status).toBe(404);
    expect(msg(d)).toBe('Không tìm thấy báo cáo');
  });

  test('TC-ADMIN-048: Member thường và khách không xử lý được báo cáo', async ({ request }) => {
    const { reportId } = await freshReport(request);
    for (const k of ['member1', 'member2']) {
      const r = await resolve(request, tok[k], reportId, { action: 'dismiss' });
      expect(r.status, k).toBe(403);
      expect(msg(r)).toBe('Bạn không có quyền thực hiện thao tác này trong cộng đồng');
    }
    const g = await resolve(request, undefined, reportId, { action: 'dismiss' });
    expect(g.status).toBe(401);
    expect(msg(g)).toBe('Vui lòng đăng nhập để tiếp tục');
    const q = await queue(request, tok.mod!, '?status=open&limit=50');
    expect((q.body.data as any[]).find((x) => x.id === reportId)?.status).toBe('open');
  });

  test('TC-ADMIN-049: Owner/mod cộng đồng khác không xử lý được báo cáo của photo', async ({ request }) => {
    const { reportId } = await freshReport(request);
    const z = await newUser(request, 'zowner');
    const photo = await call(request, 'GET', '/courses/photo', z.token);
    const mk = await call(request, 'POST', '/communities', z.token, { title: `Cộng đồng Z ${uniq()}`, description: 'Mô tả cộng đồng thử nghiệm của Z', category: photo.body.data.category, priceUsd: 0, visibility: 'public' });
    expect(mk.status, JSON.stringify(mk.body)).toBeLessThan(300);
    const r = await resolve(request, z.token, reportId, { action: 'dismiss' });
    expect(r.status).toBe(403);
    expect(msg(r)).toBe('Bạn không có quyền thực hiện thao tác này trong cộng đồng');
    const l = await queue(request, z.token);
    expect(l.status).toBe(403);
    expect(msg(l)).toBe('Bạn không có quyền thực hiện thao tác này trong cộng đồng');
    const q = await queue(request, tok.mod!, '?status=open&limit=50');
    expect((q.body.data as any[]).find((x) => x.id === reportId)?.status).toBe('open');
  });

  test('TC-ADMIN-050: Platform Admin xử lý báo cáo của cộng đồng mình không tham gia', async ({ request }) => {
    const { reportId } = await freshReport(request);
    const l = await call(request, 'GET', '/admin/reports?status=open&limit=50', tok.admin);
    expect((l.body.data as any[]).map((x) => x.id)).toContain(reportId);
    const r = await resolve(request, tok.admin, reportId, { action: 'hide_content' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({ status: 'resolved', resolvedBy: uid.admin });
    expect((await notifs(request, tok.member2!)).some((n) => n.type === 'report_resolved')).toBe(true);
  });

  test('TC-ADMIN-051: Hai mod xử lý song song: 1 thành công, 1 → 409; chỉ 1 thông báo', async ({ request }) => {
    const { reportId } = await freshReport(request);
    const before = (await notifs(request, tok.member2!)).filter((n) => n.type === 'report_resolved').length;
    const [a, b] = await Promise.all([resolve(request, tok.mod, reportId, { action: 'dismiss' }), resolve(request, tok.cadmin, reportId, { action: 'hide_content' })]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    expect(msg(loser)).toBe('Báo cáo này đã được xử lý');
    const win = a.status === 200 ? { r: a, action: 'dismiss' } : { r: b, action: 'hide_content' };
    const q = await queue(request, tok.mod!, '?limit=50');
    expect((q.body.data as any[]).find((x) => x.id === reportId)?.action).toBe(win.action);
    const after = (await notifs(request, tok.member2!)).filter((n) => n.type === 'report_resolved').length;
    expect(after - before).toBe(1);
  });

  test('TC-ADMIN-052: Bỏ ẩn bài bằng /unhide; báo cáo vẫn resolved', async ({ request }) => {
    const r = await call(request, 'POST', '/posts/seed-post-photo-m1-hidden/unhide', tok.mod);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.hidden).toBe(false);
    expect((await call(request, 'GET', '/posts/seed-post-photo-m1-hidden', tok.member3)).status).toBe(200);
    const q = await queue(request, tok.mod!, '?status=resolved&limit=50');
    expect((q.body.data as any[]).find((x) => x.id === 'seed-report-photo-resolved')).toMatchObject({ status: 'resolved', action: 'hide_content' });
  });

  test('TC-ADMIN-053: Người bị ban không tham gia lại được; cadmin bỏ ban thì tham gia lại được', async ({ request }) => {
    expect(victim, 'cần kết quả TC-ADMIN-042').toBeTruthy();
    const a = await call(request, 'POST', '/courses/photo/enroll', victim.token);
    expect(a.status).toBe(403);
    expect(msg(a)).toBe('Bạn đã bị cấm khỏi cộng đồng này');
    const u = await call(request, 'DELETE', `/courses/photo/members/${victim.id}/ban`, tok.cadmin);
    expect(u.status, JSON.stringify(u.body)).toBe(200);
    expect(u.body.data.banned).toBe(false);
    const b = await call(request, 'POST', '/courses/photo/enroll', victim.token);
    expect(b.status, JSON.stringify(b.body)).toBe(200);
    expect(b.body.data.enrolled).toBe(true);
  });

  test('TC-ADMIN-054: UI: Cấm thành viên phải xác nhận trong hộp thoại "Cấm thành viên?"', async ({ request, page }) => {
    const x = await newUser(request, 'uiban');
    await call(request, 'POST', '/courses/photo/enroll', x.token);
    const marker = `UI-BAN-${uniq()}`;
    const postId = await mkPost(request, x.token, marker);
    expect((await reportPost(request, tok.member2!, postId)).status).toBe(201);
    await uiLogin(page, 'cadmin');
    await page.goto('/communities/photo/community/kiem-duyet');
    const card = page.locator('div, li, article').filter({ hasText: marker }).filter({ has: page.getByRole('button', { name: 'Cấm thành viên' }) }).last();
    await card.getByRole('button', { name: 'Cấm thành viên' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Cấm thành viên?')).toBeVisible();
    await dialog.getByRole('button', { name: /Hủy|Huỷ/ }).click();
    await expect(page.getByText(marker).first()).toBeVisible();
    await card.getByRole('button', { name: 'Cấm thành viên' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cấm thành viên' }).click();
    await page.getByRole('tab', { name: 'Đã xử lý' }).click();
    await expect(page.getByText(marker).first()).toBeVisible();
    await expect(page.getByText('Đã cấm thành viên').first()).toBeVisible();
  });
});

/* ============================================================== Khu quản trị nền tảng */
test.describe('Khu quản trị nền tảng', () => {
  test('TC-ADMIN-056: Owner/member mở /admin: không có quyền, menu không có "Quản trị"; khách → yêu cầu đăng nhập', async ({ page }) => {
    for (const k of ['owner', 'member1']) {
      await uiLogin(page, k);
      await page.getByRole('button', { name: /Owner|Member|Linh|Minh|Nguyễn/i }).first().click().catch(() => undefined);
      await expect(page.getByRole('menuitem', { name: 'Quản trị' })).toHaveCount(0);
      await page.goto('/admin');
      await expect(page.getByText('Bạn không có quyền truy cập khu vực quản trị.')).toBeVisible();
      await page.request.post(`${API_BASE}/auth/logout`, { headers: {} }).catch(() => undefined);
    }
    const guest = await page.context().browser()!.newContext();
    const gp = await guest.newPage();
    await gp.goto('/admin');
    await expect(gp.getByRole('link', { name: /Đăng nhập/ })).toBeVisible();
    await guest.close();
  });

  let comm: { id: string; owner: { token: string; id: string }; member: { token: string; id: string } };
  test('TC-ADMIN-058: Platform Admin khóa cộng đồng → 200, owner nhận thông báo kèm lý do', async ({ request }) => {
    const owner = await newUser(request, 'cowner');
    const member = await newUser(request, 'cmember');
    const photo = await call(request, 'GET', '/courses/photo', owner.token);
    const mk = await call(request, 'POST', '/communities', owner.token, { title: `Khóa thử ${uniq()}`, description: 'Cộng đồng dùng để thử khóa/mở khóa', category: photo.body.data.category, priceUsd: 0, visibility: 'public' });
    expect(mk.status, JSON.stringify(mk.body)).toBeLessThan(300);
    const id = (mk.body.data.id ?? mk.body.data.course?.id) as string;
    expect((await call(request, 'POST', `/courses/${id}/enroll`, member.token)).status).toBeLessThan(300);
    comm = { id, owner, member };
    const r = await call(request, 'POST', `/admin/courses/${id}/lock`, tok.admin, { reason: 'Vi phạm chính sách nền tảng' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({ id, locked: true, reason: 'Vi phạm chính sách nền tảng' });
    const n = (await notifs(request, owner.token)).find((x) => x.title === 'Cộng đồng bị khóa');
    expect(n?.type).toBe('system');
    expect(n?.body).toContain('Lý do: Vi phạm chính sách nền tảng');
  });

  test('TC-ADMIN-059: Cộng đồng bị khóa: member/owner COMMUNITY_LOCKED, ẩn khỏi danh sách, chi tiết vẫn xem được, FE hiện dải khóa', async ({ request, page }) => {
    expect(comm, 'cần TC-ADMIN-058').toBeTruthy();
    for (const u of [comm.member, comm.owner]) {
      const r = await call(request, 'GET', `/courses/${comm.id}/posts`, u.token);
      expect(r.status).toBe(403);
      expect(code(r)).toBe('COMMUNITY_LOCKED');
      expect(msg(r)).toBe('Cộng đồng này đang bị khóa');
    }
    // Người MỚI tham gia cộng đồng đang khóa cũng bị chặn (thành viên cũ bấm lại chỉ là rời đi nên không thử ở đây).
    const fresh = await newUser(request, 'lockjoin');
    const en = await call(request, 'POST', `/courses/${comm.id}/enroll`, fresh.token);
    expect(en.status).toBe(403);
    expect(code(en)).toBe('COMMUNITY_LOCKED');
    const list = await call(request, 'GET', '/courses?limit=100');
    expect(JSON.stringify(list.body)).not.toContain(comm.id);
    expect((await call(request, 'GET', `/courses/${comm.id}`)).status).toBe(200);
    await page.goto(`/communities/${comm.id}`);
    await expect(page.getByText(/đang bị khóa/i).first()).toBeVisible();
  });

  test('TC-ADMIN-060: Validate lý do khóa: rỗng/khoảng trắng/501 → 400; id sai → 404', async ({ request }) => {
    for (const reason of ['', '   ', 'x'.repeat(501)]) {
      const r = await call(request, 'POST', '/admin/courses/photo/lock', tok.admin, { reason });
      expect(r.status, `len=${reason.length}`).toBe(400);
      expect(code(r)).toBe('VALIDATION_ERROR');
    }
    const n = await call(request, 'POST', '/admin/courses/khong-co/lock', tok.admin, { reason: 'x' });
    expect(n.status).toBe(404);
    expect(code(n)).toBe('NOT_FOUND');
    expect((await call(request, 'GET', '/courses/photo/posts', tok.member1)).status).toBe(200);
  });

  test('TC-ADMIN-061: Mở khóa: hoạt động trở lại, không cần lý do, gọi lại vẫn 200', async ({ request }) => {
    expect(comm, 'cần TC-ADMIN-058').toBeTruthy();
    const u = await call(request, 'POST', `/admin/courses/${comm.id}/unlock`, tok.admin);
    expect(u.status, JSON.stringify(u.body)).toBe(200);
    expect(u.body.data).toMatchObject({ id: comm.id, locked: false });
    expect((await call(request, 'GET', `/courses/${comm.id}/posts`, comm.member.token)).status).toBe(200);
    expect((await notifs(request, comm.owner.token)).some((x) => x.title === 'Cộng đồng đã được mở khóa')).toBe(true);
    expect((await call(request, 'POST', `/admin/courses/${comm.id}/unlock`, tok.admin)).status).toBe(200);
  });

  test('TC-ADMIN-062: Chỉ Platform Admin khóa/mở khóa: owner chính cộng đồng cũng 403', async ({ request }) => {
    for (const [k, path] of [['owner', 'lock'], ['cadmin', 'lock'], ['owner', 'unlock']] as const) {
      const r = await call(request, 'POST', `/admin/courses/photo/${path}`, tok[k], { reason: 'x' });
      expect(r.status, `${k} ${path}`).toBe(403);
      expect(msg(r)).toBe('Chỉ Platform Admin mới có quyền này');
    }
    const g = await call(request, 'POST', '/admin/courses/photo/lock', undefined, { reason: 'x' });
    expect(g.status).toBe(401);
    expect(msg(g)).toBe('Vui lòng đăng nhập để tiếp tục');
    expect((await call(request, 'GET', '/courses/photo/posts', tok.member1)).status).toBe(200);
  });

  test('TC-ADMIN-064: Admin lọc yêu cầu hoàn tiền pending/approved/rejected khớp seed', async ({ request }) => {
    const p = await call(request, 'GET', '/admin/refunds?status=pending', tok.admin);
    expect(p.status).toBe(200);
    expect(JSON.stringify(p.body)).toContain('seed-refund-pending');
    const a = await call(request, 'GET', '/admin/refunds?status=approved', tok.admin);
    expect(JSON.stringify(a.body)).toContain('seed-refund-approved');
    const x = await call(request, 'GET', '/admin/refunds?status=xyz', tok.admin);
    expect(x.status).toBe(400);
    expect(code(x)).toBe('VALIDATION_ERROR');
  });

  test('TC-ADMIN-065: Admin duyệt hoàn tiền: giao dịch Đã hoàn tiền, gói bị hủy', async ({ request }) => {
    const r = await call(request, 'PATCH', '/admin/refunds/seed-refund-pending', tok.admin, { action: 'approve', note: 'Đồng ý' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(JSON.stringify(r.body)).toContain('approved');
    expect(JSON.stringify(r.body)).toContain('Đồng ý');
    expect(JSON.stringify(r.body)).toContain(uid.admin!);
    const a = await call(request, 'GET', '/admin/refunds?status=approved', tok.admin);
    expect(JSON.stringify(a.body)).toContain('seed-refund-pending');
    const tx = await call(request, 'GET', '/admin/payments/transactions/seed-pay-pendref', tok.admin);
    expect(JSON.stringify(tx.body), 'giao dịch phải chuyển refunded').toMatch(/refunded/);
  });

  test('TC-ADMIN-066: Admin từ chối hoàn tiền: giao dịch giữ nguyên, người mua nhận lý do', async ({ request }) => {
    const rq = await call(request, 'POST', '/payments/seed-pay-member1-b/refund-request', tok.member1, { reason: 'Không hài lòng' });
    expect(rq.status, JSON.stringify(rq.body)).toBeLessThan(300);
    const id = rq.body.data.id ?? rq.body.data.refund?.id;
    const r = await call(request, 'PATCH', `/admin/refunds/${id}`, tok.admin, { action: 'reject', note: 'Quá hạn' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(JSON.stringify(r.body)).toContain('rejected');
    const n = (await notifs(request, tok.member1!)).find((x) => x.title === 'Yêu cầu hoàn tiền bị từ chối');
    expect(n?.type).toBe('system');
    expect(n?.body).toContain('Lý do: Quá hạn');
  });

  test('TC-ADMIN-067: Hoàn tiền đã xử lý → 409; id sai → 404; action sai → 400; owner → 403', async ({ request }) => {
    const a = await call(request, 'PATCH', '/admin/refunds/seed-refund-approved', tok.admin, { action: 'approve' });
    expect(a.status).toBe(409);
    expect(msg(a)).toBe('Yêu cầu này đã được xử lý');
    const b = await call(request, 'PATCH', '/admin/refunds/khong-co', tok.admin, { action: 'approve' });
    expect(b.status).toBe(404);
    expect(msg(b)).toBe('Không tìm thấy yêu cầu hoàn tiền');
    const c = await call(request, 'PATCH', '/admin/refunds/seed-refund-approved', tok.admin, { action: 'xoa' });
    expect(c.status).toBe(400);
    expect(code(c)).toBe('VALIDATION_ERROR');
    const d = await call(request, 'PATCH', '/admin/refunds/seed-refund-pending', tok.owner, { action: 'approve' });
    expect(d.status).toBe(403);
    expect(msg(d)).toBe('Chỉ nhân viên admin mới có quyền này');
  });

  test('TC-ADMIN-069: Admin từ chối payout: số dư của owner được hoàn lại', async ({ request }) => {
    const rev = () => call(request, 'GET', '/courses/paid-demo/revenue', tok.owner);
    const before = (await rev()).body.data;
    const r = await call(request, 'PATCH', '/admin/payouts/seed-payout-pending', tok.admin, { action: 'reject', note: 'Sai thông tin TK' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(JSON.stringify(r.body)).toContain('rejected');
    const after = (await rev()).body.data;
    expect(before.payoutRequestedCents - after.payoutRequestedCents).toBe(5000);
    expect(after.totalBalanceCents - before.totalBalanceCents).toBe(5000);
    expect(after.availableBalanceCents - before.availableBalanceCents).toBeLessThanOrEqual(5000);
    const n = (await notifs(request, tok.owner!)).find((x) => x.title === 'Yêu cầu rút tiền bị từ chối');
    expect(n?.body).toContain('Lý do: Sai thông tin TK');
  });

  test('TC-ADMIN-068: Admin duyệt payout requested → approved → paid, owner nhận thông báo mỗi bước', async ({ request }) => {
    const a = await call(request, 'PATCH', '/admin/payouts/seed-payout-pending', tok.admin, { action: 'approve' });
    expect(a.status, JSON.stringify(a.body)).toBe(200);
    expect(JSON.stringify(a.body)).toContain('approved');
    const p = await call(request, 'PATCH', '/admin/payouts/seed-payout-pending', tok.admin, { action: 'mark_paid', note: 'Đã chuyển khoản' });
    expect(p.status, JSON.stringify(p.body)).toBe(200);
    expect(JSON.stringify(p.body)).toContain('paid');
    const ns = await notifs(request, tok.owner!);
    expect(ns.some((x) => x.title === 'Yêu cầu rút tiền đã được duyệt')).toBe(true);
    expect(ns.some((x) => x.title === 'Đã chuyển tiền' && /\*{4}/.test(x.body))).toBe(true);
  });

  test('TC-ADMIN-070: Payout sai thứ tự → 409; id lạ → 404; owner/khách bị chặn', async ({ request }) => {
    const a = await call(request, 'PATCH', '/admin/payouts/seed-payout-paid', tok.admin, { action: 'approve' });
    expect(a.status).toBe(409);
    expect(msg(a)).toBe('Chỉ duyệt được yêu cầu đang chờ');
    const b = await call(request, 'PATCH', '/admin/payouts/seed-payout-paid', tok.admin, { action: 'reject' });
    expect(b.status).toBe(409);
    expect(msg(b)).toBe('Yêu cầu đã được xử lý xong');
    const c = await call(request, 'PATCH', '/admin/payouts/khong-co', tok.admin, { action: 'approve' });
    expect(c.status).toBe(404);
    expect(msg(c)).toBe('Không tìm thấy yêu cầu rút tiền');
    const d = await call(request, 'PATCH', '/admin/payouts/seed-payout-pending', tok.owner, { action: 'approve' });
    expect(d.status).toBe(403);
    expect(msg(d)).toBe('Chỉ nhân viên admin mới có quyền này');
    expect((await call(request, 'GET', '/admin/payouts', tok.owner)).status).toBe(403);
  });
});

/* ============================================================== Đa ngôn ngữ */
test.describe('Đa ngôn ngữ', () => {
  test('TC-ADMIN-006: Chuyển giao diện giữa Tiếng Việt và Tiếng Anh (trang chủ + /admin)', async ({ page }) => {
    await uiLogin(page, 'admin');
    await page.goto('/communities/photo/community');
    const toggle = page.getByRole('button', { name: /Đổi ngôn ngữ|Language|ngôn ngữ/i }).first();
    await expect(toggle).toContainText('VI');
    await toggle.click();
    await expect(toggle).toContainText('EN');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.goto('/admin');
    const t2 = page.getByRole('button', { name: /Switch language|Language|ngôn ngữ/i }).first();
    await expect(t2).toContainText('EN');
    await t2.click();
    await expect(t2).toContainText('VI');
  });

  test('TC-ADMIN-012: Ngôn ngữ đã chọn được ghi nhớ sau khi đăng xuất / đăng nhập lại', async ({ page }) => {
    await uiLogin(page, 'member1');
    await page.goto('/communities/photo/community');
    const toggle = page.getByRole('button', { name: /Đổi ngôn ngữ|Language|ngôn ngữ/i }).first();
    await expect(toggle).toContainText(/VI|EN/);
    if ((await toggle.textContent())?.includes('VI')) await toggle.click();
    await expect(toggle).toContainText('EN');
    await page.waitForTimeout(800); // chờ lưu vào tài khoản
    // Đăng xuất + xóa lựa chọn của trình duyệt, rồi đăng nhập lại bằng form.
    await page.request.post(`${API_BASE}/auth/logout`, { headers: {} }).catch(() => undefined);
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.getByPlaceholder(/email|Email/i).first().fill(email('member1'));
    await page.locator('input[type=password]').first().fill(PW);
    await page.locator('form button[type=submit]').first().click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    // trả về VI để không ảnh hưởng case khác
    await page.getByRole('button', { name: /Switch language|Đổi ngôn ngữ|Language|ngôn ngữ/i }).first().click();
  });

  test('TC-ADMIN-077: Nút ngôn ngữ topbar cộng đồng chuyển được ngôn ngữ (trước đây là nhãn tĩnh "VI")', async ({ page }) => {
    await uiLogin(page, 'mod');
    await page.goto('/communities/photo/community');
    const toggle = page.getByRole('button', { name: /Đổi ngôn ngữ|Language|ngôn ngữ/i }).first();
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText('VI');
    await toggle.click();
    await expect(toggle).toContainText('EN');
    await toggle.click();
    await expect(toggle).toContainText('VI');
  });

  test('TC-ADMIN-078: Ngôn ngữ cộng đồng (metadata) khác ngôn ngữ giao diện', async ({ request, page }) => {
    const old = (await call(request, 'GET', '/courses/photo')).body.data.language;
    const up = await call(request, 'PATCH', '/courses/photo', tok.owner, { language: 'en' });
    expect(up.status, JSON.stringify(up.body)).toBe(200);
    expect((await call(request, 'GET', '/courses/photo')).body.data.language).toBe('en');
    await uiLogin(page, 'owner');
    await page.goto('/communities/photo/community');
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
    const bad = await call(request, 'PATCH', '/courses/photo', tok.owner, { language: 'fr' });
    expect(bad.status).toBe(400);
    expect(code(bad)).toBe('VALIDATION_ERROR');
    expect((await call(request, 'PATCH', '/courses/photo', tok.owner, { language: old })).status).toBe(200);
  });
});

/* ============================================================== Chạy cuối: làm thay đổi vai trò seed */
test.describe('Cuối cùng', () => {
  test('TC-ADMIN-044: Admin cộng đồng cấm được mod nhưng không cấm được owner', async ({ request }) => {
    const A = await reportMember(request, tok.member3!, uid.mod!);
    const B = await reportMember(request, tok.member3!, uid.owner!);
    expect(A.status, JSON.stringify(A.body)).toBe(201);
    expect(B.status, JSON.stringify(B.body)).toBe(201);
    const a = await resolve(request, tok.cadmin, A.body.data.id, { action: 'ban_member' });
    expect(a.status, JSON.stringify(a.body)).toBe(200);
    expect(a.body.data.status).toBe('resolved');
    const b = await resolve(request, tok.cadmin, B.body.data.id, { action: 'ban_member' });
    expect(b.status).toBe(403);
    expect(msg(b)).toBe('Không thể cấm chủ cộng đồng');
    const q = await queue(request, tok.cadmin!, '?status=open&limit=50');
    expect((q.body.data as any[]).find((x) => x.id === B.body.data.id)?.status).toBe('open');
    await call(request, 'DELETE', `/courses/photo/members/${uid.mod}/ban`, tok.cadmin); // khôi phục
  });
});
