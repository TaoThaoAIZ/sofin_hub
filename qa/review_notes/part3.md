# Rà soát testcase - phần 3 (qa/cases_content.py: FEED, EVENT; qa/cases_classroom.py: COURSE, CERT)

Không case nào trong phạm vi có kết quả Test 1/Test 2 (toàn bộ "Chưa test"), nên không có case retired-with-results.

## Tổng kết
| Module | Số case trong file | Giữ nguyên | Sửa (UPDATE) | Loại (RETIRE) |
|---|---|---|---|---|
| FEED | 134 | 124 | 8 | 2 |
| EVENT | 90 | 86 | 2 | 2 |
| COURSE | 87 | 82 | 3 | 2 |
| CERT | 41 | 33 | 7 | 1 |
| Tổng | 352 | 325 | 20 | 7 |

## RETIRE (retired_part_3.py)
| TC | Quyết định | Lý do / bằng chứng |
|---|---|---|
| TC-FEED-150 | RETIRE | Xóa bài nay bù âm điểm đăng bài + điểm like cùng transaction (backend/docs/api/content.md "Điểm thưởng chống farm"; tests/points-policy.test.ts). Có TC-GAME-001/003/007. |
| TC-FEED-151 | RETIRE | Đăng bài có rate limit posts 10/phút/user -> 429 (middlewares/rate-limit.ts WRITE_LIMITS; posts.routes.ts). Có TC-GAME-066/017. |
| TC-EVENT-029 | RETIRE | event_created không còn cắt 200 người, rải mọi thành viên theo lô 500 (events.service.ts EVENT_NOTIFY_BATCH). Có TC-PERF-079/080. |
| TC-EVENT-062 | RETIRE | RSVP/hủy/RSVP chỉ +1 điểm (khóa nghiệp vụ; events.service.ts toggleRsvp). Có TC-GAME-013. |
| TC-COURSE-031 | RETIRE | Trùng TC-SPLIT-109 (trạng thái rỗng) + TC-SPLIT-075 (progress rỗng); viết cho 1 khóa/cộng đồng, seed không dựng lại module khi còn khóa thứ hai (prisma/seed/classroom.ts withModules). |
| TC-COURSE-107 | RETIRE | Tiền đề "classroom.md ghi in-memory" đã được sửa (classroom.md "Giới hạn hiện tại" = Postgres). |
| TC-CERT-007 | RETIRE | FE không còn hộp tích "Cấp chứng nhận khi hoàn thành 100%" cấp cộng đồng; nay admin+ dùng select "Chứng nhận hoàn thành" theo từng khóa (ClassroomEditor.tsx:366, CourseManager.tsx CertModeSelect). Có TC-SPLIT-112. |

## UPDATE (giữ nguyên tiêu đề)
| TC | Quyết định | Lý do / bằng chứng |
|---|---|---|
| TC-FEED-033 | UPDATE | Message 404 thực tế là "Không tìm thấy khóa học" (catalog.service.ts:29), không phải "cộng đồng". |
| TC-FEED-034 | UPDATE | Bỏ câu "không giới hạn tốc độ"; ghi rate limit posts 10/phút (rate-limit.ts). |
| TC-FEED-064 | UPDATE | Thêm kỳ vọng bù âm điểm khi xóa bài (content.md). |
| TC-FEED-115 | UPDATE | Bước "tạo 12 bài" vượt rate limit 10 bài/phút: thêm cách xử lý (RATE_LIMIT_DISABLED=1 / chia đợt). |
| TC-FEED-119 | UPDATE | meta nay có thêm hasMore, nextCursor (posts.service.ts list). |
| TC-FEED-130 | UPDATE | Thêm hasMore/nextCursor và page>1000 -> 400 (MAX_PAGE, posts.schema.ts). |
| TC-FEED-131 | UPDATE | Bước "tạo 25 bài" vượt rate limit: thêm cách xử lý. |
| TC-FEED-132 | UPDATE | Ghi chú giới hạn 10 bài/phút khi tạo thêm 8 bài. |
| TC-EVENT-047 | UPDATE | Thêm bù âm điểm RSVP khi xóa sự kiện (events.repository.ts delete + revokePointsInTx). |
| TC-EVENT-098 | UPDATE | URL chuẩn nay là /communities/photo/community/lich; /courses/... chỉ redirect (docs/features/community-course-split.md). |
| TC-COURSE-021 | UPDATE | Route cũ = khóa mặc định; photo có khóa thứ hai và UI có thanh chọn khóa (communities-courses.md mục 1.4; seed/classroom.ts). |
| TC-COURSE-024 | UPDATE | Nhãn thanh tiến độ là "Tiến độ: <tên khóa>" khi cộng đồng > 1 khóa (ClassroomTab.tsx:201). |
| TC-COURSE-029 | UPDATE | Cấu trúc 2x6/5-5-5-5-4/5-5-6 là của khóa mặc định; còn khóa thêm (seed/classroom.ts EXTRA_COURSES). |
| TC-CERT-002 | UPDATE | classroom-settings là mặc định cộng đồng, khóa kế thừa/override; FE không còn ô bật/tắt cấp cộng đồng (chỉ test bằng API). |
| TC-CERT-011 | UPDATE | Chữ UI nay "Khóa học này chưa bật chứng nhận hoàn thành." (ClassroomTab.tsx:231); yt có khóa thứ hai override bật. |
| TC-CERT-012 | UPDATE | courseTitle của FIN-DEMO-CERT-001 = "Tài chính cá nhân cơ bản" (seed/classroom.ts MAIN_COURSE_TITLES), không còn "Đầu tư cho người mới". |
| TC-CERT-013 | UPDATE | courseTitle = tên khóa mặc định photo ("Nhiếp ảnh cơ bản"). |
| TC-CERT-018 | UPDATE | Tên khóa hiển thị trên thẻ: "Tài chính cá nhân cơ bản". |
| TC-CERT-020 | UPDATE | Như CERT-012 (API xác minh công khai). |
| TC-CERT-028 | UPDATE | Như CERT-012 (trang /certificates/:code). |

## Đã kiểm và GIỮ (không sửa)
- "complete là toggle": vẫn đúng (classroom.service.ts:292-294, classroom.md "toggle như cũ", TC-GAME-010 ghi nhận HIỆN TẠI) - các case COURSE-048/050/051 giữ nguyên.
- Cổng module (previous_module/level), MODULE_LOCKED, staff không bị khóa, điểm bài học 1 lần: classroom.service.ts state(), points.types.ts (lesson_complete=3, post=5, like=2, event_rsvp=1), levels 0/20/60/120.
- Platform Admin chưa ghi danh vẫn qua requireMembership: enrollments.service.ts:101-103 (các case "đã sửa" đúng; lưu ý content.md nói ngược - xem mục sai lệch tài liệu).
- Link thông báo BE vẫn trả /courses/... (posts.service.ts:16, events.service.ts:18, classroom.service.ts) và FE redirect sang /communities/...; các case giữ nguyên đường dẫn /courses/....
- Ẩn/xóa/ghim/poll/like/comment/báo cáo/ICS/nhắc lịch: khớp posts.service.ts, events.service.ts, events.repository.ts, tests/content.test.ts.

## Sai lệch tài liệu/code phát hiện (không phải bug case)
- backend/docs/api/content.md mục "Quyết định thiết kế": "Platform Admin không ghi danh vẫn bị requireMembership chặn" ngược với code (enrollments.service.ts:101-103 cho qua).
- backend/docs/api/content.md: sự kiện "tối đa 200" (EVENT_CREATED_NOTIFY_LIMIT) và "Toàn bộ dữ liệu in-memory" đã lỗi thời; code rải mọi thành viên theo lô 500 và dữ liệu nằm Postgres.
- backend/docs/api/classroom.md bảng route vẫn ghi "Chưa cập nhật frontend (ClassroomTab)" - FE đã cập nhật.
