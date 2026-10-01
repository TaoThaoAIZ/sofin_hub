# Tách Community / Khóa học (Community ↔ Course) — API contract

> Trạng thái: **sự thật cuối cùng (đã triển khai + có test `tests/communities-courses.test.ts`)**. Các điểm khác bản contract đầu ở mục 7.
> Nguồn: `AUDIT-BACKEND-2026-10-01.md` §2.1, §10 bước 6. BRD §5.2/§6: *một cộng đồng có NHIỀU khóa học*.

## 0. Khái niệm

| Khái niệm | Trước | Sau |
|---|---|---|
| **Community** (cộng đồng) | Prisma `Course` (bảng `"Course"`, id = slug `photo`) | Prisma `Community` (`@@map("Course")` — **bảng/cột DB không đổi**) |
| **Course** (khóa học) | *không tồn tại* (module nằm phẳng trong cộng đồng) | Prisma `Course` (bảng `"LearningCourse"`), thuộc 1 Community, chứa nhiều `ClassroomModule` |

* Id cộng đồng vẫn là chuỗi slug (`photo`) → `:id` trong `/communities/:id` nhận id **hoặc slug** (hai thứ trùng nhau).
* Id khóa học (`:courseId`) là UUID.
* Membership/Enrollment, thanh toán, bài viết, sự kiện, điểm, báo cáo… **vẫn thuộc cộng đồng**. Chỉ `ClassroomModule`, `Certificate` (và cờ chứng nhận) gắn với khóa học.
* Mọi cộng đồng luôn có ≥ 1 khóa học. **Khóa học mặc định (default course)** = khóa `published`, chưa bị gỡ, `position` nhỏ nhất (hòa → `createdAt`); nếu không có khóa published thì khóa chưa bị gỡ đầu tiên.
* Cộng đồng tạo mới tự có 1 khóa học mặc định (title = tên cộng đồng, `published`) trong cùng transaction; dữ liệu cũ đã được backfill (mỗi cộng đồng 1 khóa chứa toàn bộ module cũ).

## 1. Tương thích ngược (quan trọng cho FE)

1. **Mọi route `/courses/:id/*` cũ vẫn chạy y nguyên** (cùng method, body, mã lỗi, JSON field).
2. **Mọi route cộng đồng-scope được mirror ở `/communities/:id/*`** (cùng handler): `GET /communities` (danh sách = `GET /courses`), `GET /communities/featured`, `GET /communities/:id`, `POST /communities/:id/enroll`, `/communities/:id/posts`, `/events`, `/members`, `/payments…`, `/modules…`, `/classroom-settings`, `/progress`, `/certificate`, … Chỉ cần đổi tiền tố `/courses` → `/communities`. (`POST /communities` tạo cộng đồng vẫn như cũ.)
3. **Tên field JSON không đổi.** Mọi response có `courseId` (= id cộng đồng) **giữ `courseId` và thêm `communityId`** cùng giá trị. `courseId` trong JSON cũ là alias *deprecated* của `communityId`.
   * Khóa học (entity mới) trong JSON của DTO khác được tham chiếu bằng **`learningCourseId`** (không dùng `courseId`, để không phá nghĩa cũ).
   * Trong **đường dẫn** mới, `:courseId` luôn là khóa học (entity mới).
4. Route cũ không có chỗ chọn khóa học (`GET /courses/:id/modules`, `/progress`, `/certificate`, `POST /courses/:id/modules`, `PUT /courses/:id/modules/order`) **hoạt động trên khóa học mặc định**. Body tạo module nhận thêm `learningCourseId?` (tùy chọn; mặc định = khóa mặc định) — route mới dùng `:courseId` trong URL thay thế.
5. Route theo id bài học (`/courses|communities/:id/lessons/:lessonId[...]`, `/modules/:moduleId` PATCH/DELETE, `/modules/:moduleId/lessons`) hoạt động trên module/bài của **mọi khóa trong cộng đồng** (id duy nhất toàn cục; khóa/tiến độ được tính trong khóa chứa module đó).

## 2. DTO

```ts
LearningCourse = {
  id: string;                 // uuid
  communityId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  position: number;           // 1..n
  publishStatus: 'published' | 'draft' | 'archived';
  certificatesEnabled: boolean | null; // override theo khóa; null = kế thừa cài đặt cộng đồng
  certificatesEffective: boolean;      // = certificatesEnabled ?? community classroom-settings.certificatesEnabled
  isDefault: boolean;                  // là khóa học mặc định của cộng đồng
  modulesCount: number;                // module hiển thị với thành viên (published, chưa gỡ)
  lessonsCount: number;
  progress: { percent: number; completedLessons: number; totalLessons: number }; // của người đang xem
  createdAt: string; updatedAt: string;
}
```
Thành viên thường chỉ thấy khóa `published`. Mod+ thấy cả `draft`/`archived` (chưa bị gỡ bởi Platform Admin).

Module/Lesson/Certificate view — **additive**:
* `ClassroomModuleView` (list) + `learningCourseId`, `communityId`. Module tạo/sửa trả `{ id, courseId /*=communityId, deprecated*/, communityId, learningCourseId, index, title, description, thumbnail?, requiredLevel?, lessonIds }`.
* `ClassroomLessonDetail` (`GET lessons/:lessonId`) + `learningCourseId`, `communityId`.
* `CertificateView` = `{ code, holderName, courseTitle /*tên khóa học*/, completedAt, issuedAt, learningCourseId, communityId }`. Xác minh công khai `GET /certificates/:code` **không đổi** (`{ valid, holderName, courseTitle, issuedAt }`).

## 3. Endpoint mới — khóa học trong cộng đồng

Tiền tố `/api/communities/:id`. Cần `Authorization` (Bearer). Quyền: member = đọc; mod+ = quản lý; admin+ = xóa khóa/đổi override chứng nhận. Cộng đồng bị khóa ⇒ 403 `COMMUNITY_LOCKED` (như route cũ).

| Method | Path | Quyền | Body / Query | Response |
|---|---|---|---|---|
| GET | `/communities/:id/courses` | member | `?status=published,draft,archived` (chỉ mod+ được lọc ngoài published) | `{ data: LearningCourse[] }` theo `position` |
| POST | `/communities/:id/courses` | mod | `{ title (1..200), description? (≤1000, mặc định ""), thumbnailUrl? (http/https), publishStatus? ('published'\|'draft', mặc định published) }` | 201 `{ data: LearningCourse }` — `position` = cuối |
| PUT | `/communities/:id/courses/order` | mod | `{ ids: string[] }` — hoán vị đủ các khóa chưa bị gỡ (400 nếu thiếu/trùng/lạ) | `{ data: LearningCourse[] }` |
| GET | `/communities/:id/courses/:courseId` | member (draft/archived: mod) | — | `{ data: LearningCourse }` (404 nếu khóa không thuộc cộng đồng) |
| PATCH | `/communities/:id/courses/:courseId` | mod (`certificatesEnabled`: admin) | `{ title?, description?, thumbnailUrl? (null để xóa), publishStatus?, certificatesEnabled? (boolean\|null) }` ≥ 1 trường | `{ data: LearningCourse }` |
| POST | `/communities/:id/courses/:courseId/archive` | mod | — | `{ data: LearningCourse }` (`publishStatus='archived'`) |
| DELETE | `/communities/:id/courses/:courseId` | admin | — | `{ data: { deleted: true } }`. **400** nếu là khóa cuối cùng của cộng đồng; cascade module/bài/tiến độ/chứng nhận của khóa |

Lớp học theo khóa (cùng schema/quy tắc với route cũ, thêm `:courseId`):

| Method | Path | Quyền |
|---|---|---|
| GET | `/communities/:id/courses/:courseId/modules` | member |
| POST | `/communities/:id/courses/:courseId/modules` | mod |
| PUT | `/communities/:id/courses/:courseId/modules/order` | mod |
| GET | `/communities/:id/courses/:courseId/modules/:moduleId/lessons` | member |
| POST | `/communities/:id/courses/:courseId/modules/:moduleId/lessons` | mod |
| PUT | `/communities/:id/courses/:courseId/modules/:moduleId/lessons/order` | mod |
| PATCH / DELETE | `/communities/:id/courses/:courseId/modules/:moduleId` | mod |
| GET | `/communities/:id/courses/:courseId/progress` | member |
| GET | `/communities/:id/courses/:courseId/certificate` | member |

Quy tắc theo khóa:
* **Khóa module tuần tự** (module sau khóa tới khi module trước hoàn thành) và `requiredLevel` chỉ tính **trong phạm vi một khóa học**. Hoàn thành khóa A không mở khóa khóa B; điểm/level vẫn tính theo cộng đồng.
* Khóa `draft`/`archived`: thành viên thường 404 trên mọi route của khóa đó; mod+ truy cập được.
* **Chứng nhận**: tối đa 1 chứng nhận / (user, khóa học); hai khóa ⇒ hai chứng nhận (mã khác nhau). Cấp được khi `certificatesEffective` = true và user hoàn thành 100% bài của khóa đó. Lỗi: 403 như cũ ("chưa bật chứng nhận" / "cần hoàn thành 100%").
* `GET/PATCH /communities|courses/:id/classroom-settings` giữ nguyên: là **mặc định của cộng đồng** (`{ certificatesEnabled }`, PATCH cần admin). Khóa học có thể override bằng `PATCH …/courses/:courseId { certificatesEnabled }`.

## 4. Route cũ — thay đổi hành vi

| Route | Trước | Sau |
|---|---|---|
| `GET /courses/:id/modules`, `/progress`, `/certificate` | module/tiến độ/chứng nhận của cộng đồng | của **khóa học mặc định** |
| `POST /courses/:id/modules`, `PUT .../modules/order` | thêm/sắp module cộng đồng | trên khóa mặc định; `POST` nhận `learningCourseId?` |
| `GET /courses/:id` (detail) | — | + `communityId`, `defaultCourseId`, `coursesCount`; `lessons` = số bài thật (tính từ DB) |
| `GET /courses`, `GET /communities` | `lessons` = hằng số seed | `lessons` = số bài hiển thị thật |
| `POST /communities` (tạo) | tạo Course | tạo Community + owner Enrollment + khóa học mặc định + settings **trong 1 transaction**; response + `defaultCourseId` |
| Certificate | `unique(userId, courseId=cộng đồng)` | `unique(userId, khóa học)`; chứng nhận cũ map vào khóa mặc định, **mã/verify không đổi** |

## 5. Admin console — Content → Courses (`/admin/content/courses*`)

Đổi nguồn dữ liệu từ `ClassroomModule` sang **entity Course mới**. Hình dạng response giữ tương thích:

`AdminCourse = { id /*course uuid*/, title, thumbnail /*thumbnailUrl*/, community: Ref, creator: Person|null, students, lessons, modules /*mới*/, completionPct, reports: 0, status: 'published'|'draft'|'archived'|'removed', moderationReason, moderatedAt, moderatedBy, createdAt }`

* `GET …/courses?communityId=` (mới) hoặc `courseId=` (legacy = **id cộng đồng**) lọc theo cộng đồng; `sort=students|lessons|title|newest|oldest`.
* Detail: `AdminCourse & { description, lessonList, moduleList: [{ id, title, lessons }], history }`.
* Actions publish/unpublish/archive/remove/restore: cùng quy tắc trạng thái; `targetType='course'`, `targetId` = id khóa học mới. Gỡ (`remove`) khóa ⇒ thành viên không thấy khóa (và module bên trong) nữa.
* Lessons admin (`/admin/content/lessons`): giữ nguyên; `moduleId` lọc module; thêm lọc `learningCourseId` (tùy chọn).

## 6. Mã lỗi

Giữ nguyên bộ lỗi hiện có (`401/403/404/400/409`, `MODULE_LOCKED`, `COMMUNITY_LOCKED`). Mới: `400` khi xóa khóa học cuối cùng; `404` khi `:courseId` không thuộc cộng đồng hoặc (thành viên thường) khóa không published.

## 7. Sai khác so với bản contract đầu / chi tiết bổ sung

1. **Tên field FK khóa học**: ở Prisma và DB là `learningCourseId` (không phải `courseId`) trên `ClassroomModule`/`Certificate` — Prisma cấm field trùng tên với cột DB của field khác (`courseId` đã là cột của `communityId`). JSON dùng `learningCourseId` đúng như contract.
2. **Alias tham số**: `middlewares/community-alias.ts` nhận `courseId` (cũ) như `communityId` ở **query** (mọi route: `/search`, `/admin/*` …) và **body** (cấp 1 + `audience`) — nên cả hai tên đều dùng được; schema nội bộ dùng `communityId`.
3. **JSON additive thêm** (ngoài mục 2): `GET /courses/:id/progress` + `learningCourseId` (`null` nếu chưa có khóa nào); post/event/report/notification/payment/subscription/refund/payout/upload/invite/join-request/review/ban… luôn có **cả** `communityId` và `courseId` (alias); `/me/points`.`byCourse[]` có `communityId`; kết quả `/search` (member/post) có `communityId`; chi tiết lỗi 402 `PAYMENT_REQUIRED` + `POST /invites/:code/accept` có `communityId`; `GET /courses/:id` có `communityId`, `defaultCourseId`, `coursesCount` (số khóa **published**).
4. `PATCH …/courses/:courseId`: `certificatesEnabled` cần **admin** (cùng quyền `classroom-settings`); mọi trường khác mod+. `DELETE` cần admin.
5. `certificatesEffective` = `certificatesEnabled ?? ClassroomSettings.certificatesEnabled`; `classroom-settings` vẫn là mặc định cộng đồng (không có override theo khóa ở endpoint này — dùng PATCH khóa).
6. Khóa học `archived`/`draft`: thành viên thường nhận **404** ở mọi route của khóa (kể cả modules/lessons/certificate); mod+ truy cập được. Khóa **bị gỡ** (admin console `remove`) biến mất với **mọi** người dùng kể cả mod.
7. Route cũ trên cộng đồng chưa có khóa nào: đọc (`modules`/`progress`) trả rỗng/0; ghi (`POST /courses/:id/modules`) tự tạo khóa mặc định (tên = tên cộng đồng).
8. Cộng đồng tạo qua `POST /communities`: slug va chạm khi tạo đồng thời thì tự thử `-2`, `-3`… (không 500).
9. Admin `GET /admin/content/courses?sort=lessons` sắp theo **số module** của khóa (Prisma không sắp theo đếm lồng 2 cấp); `AdminCourse.lessons` vẫn là số bài thật. `reports` luôn 0.
10. **Chưa làm / ngoài phạm vi**: chuyển module giữa các khóa; `GET /me/certificates`; override `requiredLevel`/mở khóa liên khóa (khóa B yêu cầu hoàn thành khóa A); route lesson theo khóa (`/communities/:id/courses/:courseId/lessons/:lessonId` — dùng route cộng đồng `/communities/:id/lessons/:lessonId`, id bài duy nhất toàn cục).
11. Cột marketplace trên `Community` (`rating`, `ratingCount`, `instructorName/Role`, `durationMinutes`, `tag`, `students`) giữ nguyên; **`lessons` không còn là hằng số seed** — luôn tính từ lớp học (bài hiển thị trong khóa published). Cột DB `Course.lessons` còn tồn tại nhưng không được đọc.
