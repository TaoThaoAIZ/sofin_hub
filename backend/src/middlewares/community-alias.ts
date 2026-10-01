import type { NextFunction, Request, Response } from 'express';

/**
 * Tách Community / Course (audit §2.1, docs/api/communities-courses.md) — lớp tương thích API, đặt ĐẦU apiRouter.
 *
 * 1. Route chuẩn `/communities/:id/*` dùng lại ĐÚNG các router `/courses/:id/*` (viết lại tiền tố; `:id` là id/slug cộng đồng):
 *      GET /communities            -> GET /courses            (danh sách)
 *      /communities/featured       -> /courses/featured
 *      /communities/:id[/...]      -> /courses/:id[/...]
 *    Ngoại lệ: `/communities/:id/courses[/...]` là họ route KHÓA HỌC mới (entity Course) và `POST /communities` (tạo) — không viết lại.
 * 2. Tham số cũ `courseId` (= id cộng đồng) trong query và body (cùng `audience.courseId`) được nhận thêm dưới tên `communityId`:
 *    schema nội bộ dùng `communityId`; client cũ gửi `courseId` vẫn chạy.
 */
const COMMUNITY_PREFIX = /^\/communities(?=\/|\?|$)/;
const NEW_COURSE_FAMILY = /^\/communities\/[^/?]+\/courses(?=\/|\?|$)/;

export function communityAlias(req: Request, _res: Response, next: NextFunction): void {
  const url = req.url;
  if (COMMUNITY_PREFIX.test(url) && !NEW_COURSE_FAMILY.test(url)) {
    const rest = url.slice('/communities'.length);
    const path = rest.split('?')[0]!;
    // `POST /communities` (tạo cộng đồng) giữ nguyên; mọi thứ khác dưới /communities ánh xạ sang /courses.
    if (!(path === '' || path === '/') || req.method === 'GET' || req.method === 'HEAD') req.url = `/courses${rest}`;
  }

  const q = req.query as Record<string, unknown>;
  if (q && q.courseId !== undefined && q.communityId === undefined) {
    Object.defineProperty(req, 'query', { value: { ...q, communityId: q.courseId }, writable: true, configurable: true });
  }

  const b = req.body as unknown;
  if (b && typeof b === 'object' && !Array.isArray(b)) {
    const body = b as Record<string, unknown>;
    if (body.courseId !== undefined && body.communityId === undefined) body.communityId = body.courseId;
    const audience = body.audience;
    if (audience && typeof audience === 'object' && !Array.isArray(audience)) {
      const a = audience as Record<string, unknown>;
      if (a.courseId !== undefined && a.communityId === undefined) a.communityId = a.courseId;
    }
  }
  next();
}
