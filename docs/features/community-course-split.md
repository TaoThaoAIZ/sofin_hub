# Tách Community / Khóa học (FE)

Audit bước 6: cái trước đây gọi là "course" thực chất là **Community**; **Khóa học (Course)** là thực thể mới nằm trong cộng đồng
(1 cộng đồng : nhiều khóa học, mỗi khóa có module/bài/tiến độ/chứng nhận riêng). Contract BE: `backend/docs/api/communities-courses.md`.

## Routes (canonical `/communities/:id/*`)

| Canonical | Ghi chú |
|---|---|
| `/communities/:id` | trang chi tiết marketplace (`CourseDetailPage`) |
| `/communities/:id/checkout`, `/communities/:id/revenue-dashboard` | thanh toán / doanh thu |
| `/communities/:id/community` (+ `lop-hoc`, `lop-hoc/:lessonId`, `kiem-duyet`, `lich`, `thanh-vien`, `xep-hang`, `gioi-thieu`, `cai-dat`) | không gian cộng đồng |
| `/communities/:id/community/lop-hoc?khoa=<courseId>` | tab Lớp học, chọn khóa học qua query `khoa` |
| `/communities/new` | tạo cộng đồng (không đổi) |

URL cũ `/courses/:id` và `/courses/:id/*` được `components/LegacyCourseRedirect.tsx` chuyển (replace) sang `/communities/:id/*`, giữ query + hash
(không gãy bookmark/email/thông báo cũ). Helper đường dẫn: `src/lib/paths.ts` (`communityHome`, `communitySettings`, `classroomPath`, `lessonPath`...).
Mọi link nội bộ (tìm kiếm, thanh toán, admin "Mở cộng đồng", mời, hồ sơ...) đã đổi sang đường dẫn canonical.

## Component / hook

- `features/community/components/ClassroomTab.tsx`: chọn khóa (thẻ ngang khi > 1 khóa; mod+ thấy cả nháp/lưu trữ kèm nhãn), module/bài/tiến độ/chứng nhận/khóa tuần tự + level **theo khóa đang chọn**; empty state khi chưa có khóa nào hiển thị; chế độ chỉnh sửa = `CourseManager` + `ClassroomEditor`.
- `CourseManager.tsx` (mới): tạo/sửa/sắp xếp/lưu trữ/xóa khóa học; `CertModeSelect` (Theo cộng đồng / Luôn bật / Luôn tắt; chỉ admin+). Dùng ở tab Lớp học (edit mode) và **Cài đặt cộng đồng → tab "Khóa học"**.
- `ClassroomEditor.tsx`: nay nhận `(communityId, course)`; tạo/sửa/xóa/sắp xếp module + bài trong khóa; override chứng nhận theo khóa.
- `pages/LessonPage.tsx`: lấy khóa từ `lesson.learningCourseId`, hiển thị breadcrumb khóa, tiến độ theo khóa; link bài trước/sau dùng `lessonPath`.
- `CertificateVerifyPage` không đổi (`GET /certificates/:code`).
- Hook mới (`features/community/queries.ts`): `useCourseList`, `useCreate/Update/Archive/Delete/ReorderCourses`; `useModules/useLessons/useProgress/useClaimCertificate` nhận `(communityId, courseId)`.
- Đổi tên pragmatic: `Community`, `CommunityDetail` (alias của `Course`/`CourseDetail`), `useCommunityDetail`, `useCommunities` (alias giữ `useCourseDetail`, `useCourses`). Thực thể mới = `LearningCourse` (tránh trùng `Course` marketplace).
- Tạo cộng đồng: bước xác nhận ghi chú hệ thống tự tạo "Khóa học chính".
- Admin → Nội dung → Khóa học: cột Module, preview có danh sách module, lọc `communityId`, sắp xếp "Mới nhất"; avatar dùng `thumbnail` thật (hết "avatar chữ cái" khi BE trả `thumbnailUrl`).

## API sử dụng

`/communities` (list), `/communities/:id` (+ `/enroll`, posts, events, members, payments...), `/communities/:id/courses` (CRUD, `order`, `:courseId/archive`),
`/communities/:id/courses/:courseId/{modules,modules/order,modules/:mid/lessons,...,progress,certificate}`, theo bài: `/communities/:id/lessons/:lessonId[/complete]`,
`/communities/:id/classroom-settings` (mặc định cộng đồng). Giữ `/admin/courses/:id/lock|unlock` (admin cộng đồng).

## Gap / còn lại

- Upload tệp bài học vẫn gửi `courseId` = id cộng đồng (`purpose: lesson_attachment`) — chờ xác nhận BE uploads nhận `communityId`.
- Chưa có trang marketplace riêng cho từng khóa học (chỉ cộng đồng); chưa có thống kê/tìm kiếm theo khóa.
- Sắp xếp khóa/module bằng nút lên/xuống (chưa kéo-thả).
- Chưa kiểm chứng end-to-end với server thật: lúc viết, BE chạy trên :4000 chưa có route `/communities/*` (xem báo cáo cuối).
- Notification/email cũ trỏ `/courses/...` vẫn chạy nhờ redirect.
