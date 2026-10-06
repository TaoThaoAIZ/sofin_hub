import type { SeedContext } from './context.js';
import { ensureAllDefaultCourses } from './courses.js';

/**
 * Lớp học: KHÓA HỌC (entity Course) → module → bài học. Mọi cộng đồng có 1 khóa mặc định chứa module/bài bên dưới; một vài cộng đồng
 * có thêm khóa học thứ 2-3 (xem EXTRA_COURSES) để thử đa khóa học. Module + bài học cho MỌI cộng đồng (cùng cấu trúc/tiêu đề như bản sinh lười cũ), cài đặt chứng nhận và kịch bản tiến độ
 * cho test thủ công. Idempotent: khóa đã có module thì bỏ qua (không ghi đè nội dung mod đã sửa); tiến độ/chứng nhận dùng skipDuplicates.
 *
 * Id xác định để tài liệu tham chiếu: module `mod-<communityId>-<n>` (n từ 1), bài học `les-<communityId>-<n>-<m>`.
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

const moduleId = (communityId: string, n: number) => `mod-${communityId}-${n}`;
const lessonId = (communityId: string, n: number, m: number) => `les-${communityId}-${n}-${m}`;

interface Plan {
  modules: { id: string; communityId: string; learningCourseId: string; index: number; title: string; description: string; requiredLevel: number | null; accessMode: 'all' | 'level' }[];
  lessons: {
    id: string; moduleId: string; communityId: string; index: number; title: string; type: 'video' | 'text'; durationMin: number; body: string;
  }[];
}

/** Cùng công thức với bản sinh cũ: số module = clamp(round(lessons/5), 2..5), chia đều, module cuối nhận phần dư. */
function plan(course: { id: string; lessons: number; durationMinutes: number }, learningCourseId: string): Plan {
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
      communityId: course.id,
      learningCourseId,
      index: mi + 1,
      title: tpl.title,
      description: tpl.description,
      requiredLevel: course.id === 'yt' && mi === 1 ? 2 : null,
      accessMode: course.id === 'yt' && mi === 1 ? 'level' : 'all',
    });
    for (let li = 0; li < lessonCount; li++) {
      out.lessons.push({
        id: lessonId(course.id, mi + 1, li + 1),
        moduleId: moduleId(course.id, mi + 1),
        communityId: course.id,
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

/** Khóa học thêm (ngoài khóa mặc định) cho vài cộng đồng — module/bài id xác định: `mod-<key>-<n>`, `les-<key>-<n>-<m>`. */
interface ExtraCourse {
  key: string;
  communityId: string;
  title: string;
  description: string;
  publishStatus?: 'published' | 'draft' | 'archived';
  certificatesEnabled?: boolean | null;
  modules: { title: string; lessons: number }[];
}
const EXTRA_COURSES: ExtraCourse[] = [
  {
    key: 'photo-editing', communityId: 'photo', title: 'Chỉnh sửa ảnh nâng cao', description: 'Lightroom, Photoshop và quy trình hậu kỳ chuyên nghiệp.',
    modules: [{ title: 'Lightroom từ A đến Z', lessons: 4 }, { title: 'Retouch chân dung với Photoshop', lessons: 4 }],
  },
  {
    key: 'yt-growth', communityId: 'yt', title: 'Tối ưu kênh & tăng trưởng', description: 'SEO video, thumbnail và chiến lược nội dung dài hạn.',
    certificatesEnabled: true, // ghi đè: yt không bật chứng nhận ở cấp cộng đồng nhưng khóa này có cấp
    modules: [{ title: 'SEO & thuật toán đề xuất', lessons: 3 }, { title: 'Thumbnail & tiêu đề thu hút', lessons: 3 }],
  },
  {
    key: 'fin-invest', communityId: 'fin', title: 'Quản lý danh mục đầu tư', description: 'Từ quỹ dự phòng tới danh mục đầu tư đầu tiên.',
    modules: [{ title: 'Nguyên tắc đầu tư', lessons: 3 }, { title: 'Xây danh mục đầu tiên', lessons: 3 }],
  },
  {
    key: 'fin-risk', communityId: 'fin', title: 'Quản trị rủi ro (bản nháp)', description: 'Đang soạn — chưa hiển thị với thành viên.', publishStatus: 'draft',
    modules: [{ title: 'Nhận diện rủi ro', lessons: 2 }],
  },
];
const extraCourseId = (key: string) => `course-${key}`;
const extraModuleId = (key: string, n: number) => `mod-${key}-${n}`;
const extraLessonId = (key: string, n: number, m: number) => `les-${key}-${n}-${m}`;

/** Tên khóa mặc định của cộng đồng trình diễn (chỉ đổi khi còn mang tên cộng đồng — không ghi đè chỉnh sửa của mod). */
const MAIN_COURSE_TITLES: Record<string, string> = { photo: 'Nhiếp ảnh cơ bản', yt: 'YouTube từ con số 0', fin: 'Tài chính cá nhân cơ bản' };

export const CERT_CODE_PHOTO_EDITING_MEMBER1 = 'PHOTO-DEMO-CERT-002';

export async function seedClassroom(ctx: SeedContext): Promise<void> {
  const { db, userIds } = ctx;
  await ensureAllDefaultCourses(db);
  const courses = await db.community.findMany({ where: { moderationStatus: { not: 'draft' } }, select: { id: true, title: true, lessons: true, durationMinutes: true } });
  const mainCourseOf = new Map<string, string>();
  for (const c of await db.course.findMany({ where: { removedAt: null }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true, communityId: true, title: true } })) {
    if (!mainCourseOf.has(c.communityId)) {
      mainCourseOf.set(c.communityId, c.id);
      const nice = MAIN_COURSE_TITLES[c.communityId];
      const community = courses.find((x) => x.id === c.communityId);
      if (nice && community && c.title === community.title) await db.course.update({ where: { id: c.id }, data: { title: nice } });
    }
  }
  const withModules = new Set((await db.classroomModule.findMany({ select: { communityId: true }, distinct: ['communityId'] })).map((m) => m.communityId));

  const modules: Plan['modules'] = [];
  const lessons: Plan['lessons'] = [];
  for (const c of courses) {
    if (withModules.has(c.id)) continue; // đã có nội dung (seed trước hoặc mod tạo) -> không ghi đè
    const p = plan(c, mainCourseOf.get(c.id)!);
    modules.push(...p.modules);
    lessons.push(...p.lessons);
  }
  if (modules.length) await db.classroomModule.createMany({ data: modules, skipDuplicates: true });
  if (lessons.length) await db.classroomLesson.createMany({ data: lessons, skipDuplicates: true });

  // ---- Khóa học thêm (đa khóa học) ----
  const extraLessons: Record<string, string[]> = {}; // key -> id bài theo thứ tự
  for (const x of EXTRA_COURSES) {
    if (!courses.some((c) => c.id === x.communityId)) continue;
    const id = extraCourseId(x.key);
    const exists = await db.course.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      const position = ((await db.course.aggregate({ where: { communityId: x.communityId }, _max: { position: true } }))._max.position ?? 0) + 1;
      await db.course.create({
        data: {
          id, communityId: x.communityId, title: x.title, description: x.description, position, publishStatus: x.publishStatus ?? 'published',
          certificatesEnabled: x.certificatesEnabled ?? null,
        },
      });
      await db.classroomModule.createMany({
        data: x.modules.map((m, mi) => ({ id: extraModuleId(x.key, mi + 1), communityId: x.communityId, learningCourseId: id, index: mi + 1, title: m.title, description: `${m.title} — bài giảng theo từng bước.` })),
        skipDuplicates: true,
      });
      await db.classroomLesson.createMany({
        data: x.modules.flatMap((m, mi) =>
          Array.from({ length: m.lessons }, (_, li) => ({
            id: extraLessonId(x.key, mi + 1, li + 1), moduleId: extraModuleId(x.key, mi + 1), communityId: x.communityId, index: li + 1,
            title: `Bài ${li + 1}: ${m.title}`, type: (li % 3 === 2 ? 'text' : 'video') as 'text' | 'video', durationMin: 8,
            body: 'Nội dung bài học minh họa — mod/admin có thể chỉnh sửa trong phần quản lý lớp học.',
          })),
        ),
        skipDuplicates: true,
      });
    }
    extraLessons[x.key] = x.modules.flatMap((m, mi) => Array.from({ length: m.lessons }, (_, li) => extraLessonId(x.key, mi + 1, li + 1)));
  }

  // ---- Cài đặt chứng nhận ----
  for (const communityId of ['photo', 'fin']) {
    if (courses.some((c) => c.id === communityId)) {
      await db.classroomSettings.upsert({ where: { communityId }, create: { communityId, certificatesEnabled: true }, update: {} });
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
  const idsOf = (communityId: string, n: number, count: number) => Array.from({ length: count }, (_, i) => lessonId(communityId, n, i + 1));

  const cnt = (communityId: string, n: number) => lessons.filter((l) => l.moduleId === moduleId(communityId, n)).length;
  const countOf = async (communityId: string, n: number) =>
    cnt(communityId, n) || (await db.classroomLesson.count({ where: { moduleId: moduleId(communityId, n) } }));

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
    // Khóa học thêm: member1 xong TOÀN BỘ "Chỉnh sửa ảnh nâng cao" (photo) -> chứng nhận thứ 2 (khác khóa mặc định); xong 3/6 "Quản lý danh mục đầu tư" (fin).
    const photoEditing = extraLessons['photo-editing'] ?? [];
    complete(userIds.member1, photoEditing, 1 * 24 * 60);
    complete(userIds.member1, (extraLessons['fin-invest'] ?? []).slice(0, 3), 12 * 60);

    const valid = new Set(
      (await db.classroomLesson.findMany({ where: { id: { in: rows.map((r) => r.lessonId) } }, select: { id: true } })).map((l) => l.id),
    );
    const data = rows.filter((r) => valid.has(r.lessonId));
    if (data.length) await db.lessonProgress.createMany({ data, skipDuplicates: true });

    // ---- Chứng nhận cố định của member1 (mỗi khóa học 1 chứng nhận) ----
    const holder = await db.user.findUnique({ where: { id: userIds.member1 }, select: { firstName: true, lastName: true } });
    const holderName = `${holder?.firstName ?? ''} ${holder?.lastName ?? ''}`.trim();
    const lastDone = (ids: string[]) => rows.filter((r) => ids.includes(r.lessonId)).reduce((m, r) => Math.max(m, r.completedAt.getTime()), 0);
    const finCourseId = mainCourseOf.get('fin');
    if (courses.some((c) => c.id === 'fin') && finCourseId && finCount && finIds.every((id) => valid.has(id))) {
      const finCourse = await db.course.findUniqueOrThrow({ where: { id: finCourseId }, select: { title: true } });
      await db.certificate.upsert({
        where: { userId_learningCourseId: { userId: userIds.member1, learningCourseId: finCourseId } },
        create: {
          code: CERT_CODE_FIN_MEMBER1, userId: userIds.member1, communityId: 'fin', learningCourseId: finCourseId, holderName,
          courseTitle: finCourse.title, completedAt: new Date(lastDone(finIds) || now),
        },
        update: {},
      });
    }
    if (photoEditing.length && photoEditing.every((id) => valid.has(id))) {
      const cid = extraCourseId('photo-editing');
      await db.certificate.upsert({
        where: { userId_learningCourseId: { userId: userIds.member1, learningCourseId: cid } },
        create: {
          code: CERT_CODE_PHOTO_EDITING_MEMBER1, userId: userIds.member1, communityId: 'photo', learningCourseId: cid, holderName,
          courseTitle: 'Chỉnh sửa ảnh nâng cao', completedAt: new Date(lastDone(photoEditing) || now),
        },
        update: {},
      });
    }
  }
}
