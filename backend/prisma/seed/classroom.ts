import type { SeedContext } from './context.js';

/**
 * Lớp học: module + bài học cho MỌI cộng đồng (cùng cấu trúc/tiêu đề như bản sinh lười cũ), cài đặt chứng nhận và kịch bản tiến độ
 * cho test thủ công. Idempotent: khóa đã có module thì bỏ qua (không ghi đè nội dung mod đã sửa); tiến độ/chứng nhận dùng skipDuplicates.
 *
 * Id xác định để tài liệu tham chiếu: module `mod-<courseId>-<n>` (n từ 1), bài học `les-<courseId>-<n>-<m>`.
 * Module thumbnail = null (FE có ảnh dự phòng).
 *
 * Kịch bản (tài khoản test, mật khẩu chung):
 *  - photo (12 bài = 2 module x 6): member1 xong TOÀN BỘ module 1 (module 2 mở khóa), member2 xong 2 bài đầu, member3 chưa học gì.
 *    certificatesEnabled = true.
 *  - yt (24 bài = 4 module x 5 + 1 x 4): module 2 có requiredLevel = 2; member1 xong toàn bộ module 1 -> module 2 bị khóa theo cấp độ
 *    cho tới khi member1 đạt >= 20 điểm ở yt.
 *  - fin (16 bài = 5+5+6): certificatesEnabled = true; member1 xong 100% và ĐÃ có chứng nhận mã cố định FIN-DEMO-CERT-001
 *    (fin là cộng đồng nhỏ nhất mà member1 tham gia; photo giữ nguyên kịch bản học dở để test).
 */
const MODULE_TEMPLATE = [
  { title: 'Chào mừng & Lộ trình', description: 'Làm quen cộng đồng và lộ trình học tập.' },
  { title: 'Tư duy & Nền tảng', description: 'Xây nền tảng kiến thức cốt lõi.' },
  { title: 'Kỹ năng thực chiến', description: 'Áp dụng kiến thức vào tình huống thực tế.' },
  { title: 'Nâng cao & Mở rộng', description: 'Đào sâu kỹ thuật, tăng hiệu quả.' },
  { title: 'Dự án tổng kết', description: 'Hoàn thiện dự án cuối khóa, nhận phản hồi.' },
];

export const CERT_CODE_FIN_MEMBER1 = 'FIN-DEMO-CERT-001';

const moduleId = (courseId: string, n: number) => `mod-${courseId}-${n}`;
const lessonId = (courseId: string, n: number, m: number) => `les-${courseId}-${n}-${m}`;

interface Plan {
  modules: { id: string; courseId: string; index: number; title: string; description: string; requiredLevel: number | null }[];
  lessons: {
    id: string; moduleId: string; courseId: string; index: number; title: string; type: 'video' | 'text'; durationMin: number; body: string;
  }[];
}

/** Cùng công thức với bản sinh cũ: số module = clamp(round(lessons/5), 2..5), chia đều, module cuối nhận phần dư. */
function plan(course: { id: string; lessons: number; durationMinutes: number }): Plan {
  const moduleCount = Math.min(MODULE_TEMPLATE.length, Math.max(2, Math.round(course.lessons / 5)));
  const minutesPerLesson = course.durationMinutes / Math.max(1, course.lessons);
  let remaining = course.lessons;
  const out: Plan = { modules: [], lessons: [] };
  MODULE_TEMPLATE.slice(0, moduleCount).forEach((tpl, mi) => {
    const isLast = mi === moduleCount - 1;
    const lessonCount = Math.max(1, isLast ? remaining : Math.round(course.lessons / moduleCount));
    remaining -= lessonCount;
    out.modules.push({
      id: moduleId(course.id, mi + 1),
      courseId: course.id,
      index: mi + 1,
      title: tpl.title,
      description: tpl.description,
      requiredLevel: course.id === 'yt' && mi === 1 ? 2 : null,
    });
    for (let li = 0; li < lessonCount; li++) {
      out.lessons.push({
        id: lessonId(course.id, mi + 1, li + 1),
        moduleId: moduleId(course.id, mi + 1),
        courseId: course.id,
        index: li + 1,
        title: `Bài ${li + 1}: ${tpl.title}${lessonCount > 1 ? ` (Phần ${li + 1}/${lessonCount})` : ''}`,
        type: li % 4 === 3 ? 'text' : 'video',
        durationMin: Math.max(3, Math.round(minutesPerLesson)),
        body: 'Nội dung bài học minh họa — mod/admin có thể chỉnh sửa trong phần quản lý lớp học.',
      });
    }
  });
  return out;
}

export async function seedClassroom(ctx: SeedContext): Promise<void> {
  const { db, userIds } = ctx;
  const courses = await db.course.findMany({ select: { id: true, title: true, lessons: true, durationMinutes: true } });
  const withModules = new Set((await db.classroomModule.findMany({ select: { courseId: true }, distinct: ['courseId'] })).map((m) => m.courseId));

  const modules: Plan['modules'] = [];
  const lessons: Plan['lessons'] = [];
  for (const c of courses) {
    if (withModules.has(c.id)) continue; // đã có nội dung (seed trước hoặc mod tạo) -> không ghi đè
    const p = plan(c);
    modules.push(...p.modules);
    lessons.push(...p.lessons);
  }
  if (modules.length) await db.classroomModule.createMany({ data: modules, skipDuplicates: true });
  if (lessons.length) await db.classroomLesson.createMany({ data: lessons, skipDuplicates: true });

  // ---- Cài đặt chứng nhận ----
  for (const courseId of ['photo', 'fin']) {
    if (courses.some((c) => c.id === courseId)) {
      await db.classroomSettings.upsert({ where: { courseId }, create: { courseId, certificatesEnabled: true }, update: {} });
    }
  }

  // ---- Tiến độ học của tài khoản test (chỉ tạo khi bài học seed còn tồn tại) ----
  const now = Date.now();
  const rows: { userId: string; lessonId: string; completedAt: Date; firstCompletedAt: Date }[] = [];
  const complete = (userId: string, ids: string[], minutesAgoStart: number) =>
    ids.forEach((id, i) => {
      const at = new Date(now - (minutesAgoStart - i * 10) * 60_000); // bài sau hoàn thành muộn hơn
      rows.push({ userId, lessonId: id, completedAt: at, firstCompletedAt: at });
    });
  const idsOf = (courseId: string, n: number, count: number) => Array.from({ length: count }, (_, i) => lessonId(courseId, n, i + 1));

  const cnt = (courseId: string, n: number) => lessons.filter((l) => l.moduleId === moduleId(courseId, n)).length;
  const countOf = async (courseId: string, n: number) =>
    cnt(courseId, n) || (await db.classroomLesson.count({ where: { moduleId: moduleId(courseId, n) } }));

  if (userIds.member1 && userIds.member2) {
    complete(userIds.member1, idsOf('photo', 1, await countOf('photo', 1)), 6 * 24 * 60);
    complete(userIds.member2, idsOf('photo', 1, 2), 3 * 24 * 60);
    complete(userIds.member1, idsOf('yt', 1, await countOf('yt', 1)), 4 * 24 * 60);
    let finCount = 0;
    const finIds: string[] = [];
    for (let n = 1; ; n++) {
      const c = await countOf('fin', n);
      if (!c) break;
      finIds.push(...idsOf('fin', n, c));
      finCount += c;
    }
    if (finCount) complete(userIds.member1, finIds, 2 * 24 * 60);

    const valid = new Set(
      (await db.classroomLesson.findMany({ where: { id: { in: rows.map((r) => r.lessonId) } }, select: { id: true } })).map((l) => l.id),
    );
    const data = rows.filter((r) => valid.has(r.lessonId));
    if (data.length) await db.lessonProgress.createMany({ data, skipDuplicates: true });

    // ---- Chứng nhận cố định của member1 ở fin ----
    const fin = courses.find((c) => c.id === 'fin');
    if (fin && finCount && finIds.every((id) => valid.has(id))) {
      const holder = await db.user.findUnique({ where: { id: userIds.member1 }, select: { firstName: true, lastName: true } });
      const last = rows.filter((r) => finIds.includes(r.lessonId)).reduce((m, r) => Math.max(m, r.completedAt.getTime()), 0);
      await db.certificate.upsert({
        where: { userId_courseId: { userId: userIds.member1, courseId: 'fin' } },
        create: {
          code: CERT_CODE_FIN_MEMBER1,
          userId: userIds.member1,
          courseId: 'fin',
          holderName: `${holder?.firstName ?? ''} ${holder?.lastName ?? ''}`.trim(),
          courseTitle: fin.title,
          completedAt: new Date(last || now),
        },
        update: {},
      });
    }
  }
}
