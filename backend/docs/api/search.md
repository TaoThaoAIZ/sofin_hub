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

Với `type=all` kết quả xếp: khóa học, thành viên, bài viết, rồi phân trang chung; `counts` cho biết tổng theo loại. Trong mỗi nhóm xếp theo độ liên quan (xem dưới).

## Cách hoạt động (STEP 8 audit: Postgres full-text)
Mọi lọc / xếp hạng / phân trang chạy trong SQL (`search.repository.ts`); `search.service.ts` chỉ dựng phạm vi, cắt trang qua 3 nhóm và sinh `Segment[]` cho đúng các dòng của trang.
- **Cột sinh sẵn** (migration `20261005100000_search_fulltext`): `Course.searchVector` (title trọng số A + description B), `Post.searchVector` (content A + tags B), `User.searchVector` (họ tên), kiểu `tsvector GENERATED ALWAYS ... STORED` + GIN. Văn bản được gập dấu bằng hàm SQL `sf_fold()` (IMMUTABLE, tự viết thay cho `unaccent` vì `unaccent` không IMMUTABLE nên không dùng được trong cột generated): bỏ dấu tổ hợp, `đ`->`d`, hạ chữ thường, không phụ thuộc locale DB. Cấu hình `simple` (không stop-word, không stem — hợp tiếng Việt).
- **Một từ khóa khớp khi** (a) mọi từ trong `q` là *tiền tố* của một từ trong văn bản (toàn văn, GIN) — gõ dở từ vẫn ra, các từ không cần liền nhau/đúng thứ tự; hoặc (b) là *chuỗi con* của tên khóa học / họ tên (`LIKE` + GIN trigram `Course_title_trgm_idx`, `User_name_trgm_idx`); hoặc (c) gõ sai chính tả tên khóa học / họ tên (`pg_trgm` `word_similarity`, chỉ khi `q` >= 4 ký tự, ngưỡng mặc định 0,6). Bài viết: (a) trên nội dung + thẻ, hoặc tên tác giả khớp. `%`, `_`, `\` trong `q` được escape (không phải ký tự đại diện).
- **Xếp hạng**: khóa học = `reduced` xếp sau cùng, rồi điểm (`ts_rank` chuẩn hóa độ dài + 1 nếu tên chứa nguyên cụm + 0,5 x độ giống trigram), rồi mới nhất. Thành viên = điểm tên rồi `lastActiveAt`. Bài viết = `ts_rank` rồi mới nhất (bản cũ: chỉ mới nhất).
- **Phân trang**: đếm 1 truy vấn / nhóm, rồi mỗi nhóm chỉ lấy đoạn `LIMIT/OFFSET` giao với trang — không còn trần 1.000 bài/thành viên mỗi cộng đồng; `page` tối đa `MAX_PAGE=1000`.
- **Gợi ý (`/search/suggest`)**: 3 truy vấn `LIMIT 5` riêng (khóa học / thành viên / bài viết) rồi xen kẽ — không còn chạy lại toàn bộ phép quét.
- **Tô đậm** (`Segment[]`) tính trên đúng các dòng của trang: ưu tiên nguyên cụm, nếu từ khóa khớp theo từ rời nhau thì tô từ đơn dài nhất có mặt; kết quả khớp do gõ sai không có đoạn tô.
- Số truy vấn: xem `backend/docs/DATABASE.md`, mục "Số truy vấn trước/sau" (dữ liệu thử: 125 -> 7 truy vấn mỗi lần tìm; ở quy mô audit ~11.000 -> ~8).

## Quy tắc hiển thị (giữ nguyên, nay nằm trong WHERE)
- **Khóa học**: `visibility=public`, chưa xóa mềm, không `locked`, `moderationStatus=active`, `searchVisibility<>hidden` (`discoveryStatus` listed/unlisted/hidden đều tìm được — chỉ danh sách Khám phá mới lọc theo nó). `searchVisibility=reduced` luôn xếp sau. `courseId` (nếu có) giới hạn đúng 1 khóa.
- **Bài viết & thành viên**: chỉ trong cộng đồng user đang là thành viên (không bị cấm, chưa xóa, không bị khóa), hoặc đúng `courseId` (bắt buộc là thành viên, nếu không 403; 404 nếu không có). Bài `removedAt` (Platform Admin gỡ): không ai thấy. Bài `hidden`: chỉ mod+ (hoặc Platform Admin) thấy — **tác giả thường không tự thấy bài ẩn của mình trong tìm kiếm** (khác feed). Tài khoản đã xóa hiện "Thành viên đã xóa".
- **Thành viên**: khớp tên; `handle` (tính khi đọc, `slug-NNNN`) chỉ khớp phần slug khi `q` có dấu `-` (phần số đuôi không tra được trong SQL).
- Rate limit: 40 request/phút theo user (hoặc IP), 429 khi vượt; nới gần như vô hạn khi `NODE_ENV=test`. Dùng state chia sẻ (`infra/shared`): Redis khi đặt `REDIS_URL`, không thì in-memory; lỗi store => cho qua (fail-open).
- `GET /courses?q=` dùng cùng bộ khớp (id khớp chọn bằng SQL, rồi mới nạp các khóa đó) — không còn đọc cả bảng `Course`.

## Yêu cầu hạ tầng
- Extension **`pg_trgm`** (migration tự `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public` nếu chưa có; từ PG13 là *trusted extension* nên chủ database là đủ quyền). Xem `DEPLOY.md`. Nếu extension nằm schema khác, code tra schema lúc chạy (`pg_extension`); nếu KHÔNG cài được, migration thất bại có chủ đích.
- Thêm cột `GENERATED` => `prisma migrate dev` sẽ thấy lệch `ALTER COLUMN "searchVector" DROP DEFAULT` cho 3 bảng: **bỏ dòng đó** khỏi migration được sinh (cột sinh sẵn không thể DROP DEFAULT).

## Chưa làm / cần quyết định
- Tìm trong bình luận, sự kiện, bài học lớp học (`ClassroomLesson` chưa được tìm hôm nay nên chưa có vector); tìm tag riêng (`#tag`).
- Khớp chuỗi con ở giữa từ cho nội dung bài/mô tả khóa (chỉ có tiền tố từ; chuỗi con chỉ cho tên khóa/tên người). Nếu cần: thêm GIN trigram cho `Post.content` (index rất lớn).
- Lưu lịch sử tìm kiếm gần đây.
