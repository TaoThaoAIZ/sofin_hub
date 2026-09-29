# API Tìm kiếm

Module: `src/modules/search/`. Cần đăng nhập (Bearer).

| Method | Path | Auth | Query | Response | Lỗi |
|---|---|---|---|---|---|
| GET | `/search` | Bearer | `q` (2-100 ký tự), `type=all\|posts\|members\|courses` (mặc định all), `courseId?`, `page`, `limit` (<=50, mặc định 10) | `{data: Result[], meta, counts: {courses, members, posts}}` | 400, 401, 403 (courseId mà không là thành viên), 404 (courseId không tồn tại), 429 |
| GET | `/search/suggest` | Bearer | `q` (2-100) | `{data: Result[]}` tối đa 5, xen kẽ khóa học/thành viên/bài viết | 400, 401, 429 |

`Result` (có trường `type`):
- `course`: `{id, title: Segment[], snippet: Segment[], link}`
- `member`: `{id, courseId, courseTitle, name: Segment[], handle, role, link}`
- `post`: `{id, courseId, courseTitle, author, snippet: Segment[], createdAt, link}`
- `Segment = {text: string, match: boolean}`. Server KHÔNG trả HTML; FE render từng segment bằng text node (đoạn `match` bọc `<mark>`), nên không có rủi ro XSS.

Với `type=all` kết quả xếp: khóa học, thành viên, bài viết (mới nhất trước), rồi phân trang chung; `counts` cho biết tổng theo loại.

## Quyết định thiết kế
- Khóa học: mọi khóa `visibility=public` (bỏ qua khóa có cờ `locked`/`deletedAt` nếu module khác thêm), khớp `title`/`description`.
- Bài viết & thành viên: chỉ trong cộng đồng user đang là thành viên (`enrollmentService.listByUser`), hoặc đúng `courseId` (bắt buộc là thành viên, nếu không 403). Bài có cờ `hidden` chỉ hiện với mod trở lên (kiểm qua `policy.getRole/atLeast`). Hiện `Post` chưa có trường `hidden` nên bước này chưa có tác dụng cho đến khi nhóm bài viết thêm.
- Khớp không phân biệt dấu/hoa thường: NFD, bỏ dấu tổ hợp, `đ`->`d`. Có bản đồ vị trí để tô đúng đoạn chữ gốc có dấu.
- Chỉ dùng API đã export của module khác (`courseService.list`, `postsService.list`, `communityService.listMembers`, `enrollmentService.listByUser`); không sửa file module khác.
- Rate limit: 40 request/phút theo user (hoặc IP), 429 khi vượt; nới gần như vô hạn khi `NODE_ENV=test`.

## Giới hạn hiệu năng
- Lọc trong bộ nhớ: mỗi truy vấn duyệt toàn bộ bài/thành viên của các cộng đồng của user (tối đa 20 trang x 50 mục mỗi cộng đồng). Chấp nhận được ở quy mô demo; khi lớn hơn sẽ chậm và bỏ sót phần vượt trần.
- Chỉ khớp chuỗi con nguyên cụm (`q` là 1 cụm), không xếp hạng theo độ liên quan, không sửa lỗi gõ.
- Rate limit in-memory, chỉ đúng với 1 instance.

## Chưa làm / cần quyết định
- Nâng cấp Postgres: cột `tsvector` + GIN (`unaccent`, `to_tsquery('simple', ...)`) hoặc `pg_trgm` cho gợi ý; đẩy lọc quyền xuống SQL (join bảng thành viên).
- Tìm trong bình luận, sự kiện, bài học lớp học; tìm tag riêng (`#tag`).
- Lưu lịch sử tìm kiếm gần đây.
