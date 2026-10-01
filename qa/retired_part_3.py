# -*- coding: utf-8 -*-
RETIRED = {
    "TC-FEED-150": "Lỗi thời: xóa bài nay BÙ ÂM điểm đăng bài + điểm like trong cùng transaction (backend/docs/api/content.md mục 'Điểm thưởng chống farm', posts.repository delete + tests/points-policy.test.ts); đã có TC-GAME-001/003/007.",
    "TC-FEED-151": "Lỗi thời: đăng bài nay có rate limit nhóm posts 10 lần/phút/user -> 429 (middlewares/rate-limit.ts WRITE_LIMITS, posts.routes.ts writeRateLimit('posts')); đã có TC-GAME-066/017.",
    "TC-EVENT-029": "Lỗi thời: event_created không còn cắt cứng 200 người; nay rải cho MỌI thành viên theo lô 500 (events.service.ts EVENT_NOTIFY_BATCH); đã có TC-PERF-079/080.",
    "TC-EVENT-062": "Lỗi thời: RSVP/hủy/RSVP chỉ +1 điểm nhờ khóa nghiệp vụ (user,event_rsvp,event,eventId) (events.service.ts toggleRsvp, content.md, tests/points-policy.test.ts); đã có TC-GAME-013.",
    "TC-COURSE-031": "Trùng/thay thế: trạng thái rỗng 'Lớp học chưa có nội dung.' đã có TC-SPLIT-109 và progress rỗng/0 ở TC-SPLIT-075; case cũ viết cho 1 khóa/cộng đồng, thao tác xóa mọi module và seed không dựng lại được khi còn khóa thứ hai (seed/classroom.ts withModules).",
    "TC-COURSE-107": "Lỗi thời: tiền đề 'classroom.md ghi dữ liệu trong bộ nhớ' đã được sửa (classroom.md 'Giới hạn hiện tại' ghi Postgres); độ bền dữ liệu sau restart thuộc INFRA/DB.",
    "TC-CERT-007": "Lỗi thời: FE không còn ô 'Cấp chứng nhận khi hoàn thành 100%' cấp cộng đồng; nay admin+ chọn 'Chứng nhận hoàn thành' (Theo cộng đồng/Luôn bật/Luôn tắt) theo TỪNG khóa (ClassroomEditor.tsx:366, CourseManager.tsx CertModeSelect); đã có TC-SPLIT-112.",
}
