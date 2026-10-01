# Giai đoạn 2B — chuyển các module còn lại sang Postgres (quy tắc chung cho các agent)

Đọc trước: `DATABASE.md` (đặc biệt "điều agent sau cần biết"), `CONVENTIONS.md`, `API.md`, `prisma/schema.prisma`, `tests/helpers.ts`, và repository đã chuyển xong làm mẫu: `src/modules/auth/auth.repository.ts`, `src/modules/catalog/catalog.repository.ts`, `src/modules/enrollments/enrollments.repository.ts`.

## Mục tiêu
Thay `inMemory...Repository` của các module được giao bằng hiện thực Prisma của CÙNG interface (đổi interface khi thật cần, nhưng KHÔNG đổi hình dạng response API và hành vi đã có test). Dữ liệu minh họa được sinh lười khi mở cộng đồng (`ensureSeeded`, `*.seed.ts`) → chuyển thành **seed vào DB** (`prisma/seed/<module>.ts`, idempotent) và bỏ hành vi sinh lười khỏi runtime. Test của module phải chạy với DB thật (mặc định) và xanh.

## Thành viên demo
Các id `seed:<courseId>:<i>` biến mất; thay bằng User thật `isDemo=true`, id `demo-<courseId>-<i>` (xem `prisma/seed/demo-ids.ts`: `DEMO_NAMES`, `demoUserId`, `demoEmail`). Agent `communities` tạo User+Enrollment trong `prisma/seed/demo-members.ts` và chạy TRƯỚC các seed khác. Seed của bạn chỉ THAM CHIẾU các id này (tác giả bài viết, người RSVP, người gửi tin...). Mọi chỗ code runtime từng phân biệt "seed:" (vd. "thành viên minh họa trả 404 khi kick") đổi thành phân biệt bằng `User.isDemo`, giữ nguyên hành vi/thông điệp ra ngoài. `seedAuthorName`/`seedHostName` bỏ đi — tên lấy từ User.

## Ràng buộc làm việc song song (nhiều agent cùng lúc)
- Chỉ sửa file trong phạm vi được giao. Chỗ khác chỉ sửa TỐI THIỂU khi bắt buộc để build (ghi lại file+dòng trong báo cáo).
- KHÔNG sửa `tests/helpers.ts`, `prisma/seed-base.ts`, `prisma/seed.ts` (cần thêm gì thì báo cáo). Không đổi tên/xóa cột schema. Cần thêm cột/bảng: hạn chế tối đa; nếu buộc phải thì thêm migration MỚI viết tay `prisma/migrations/<YYYYMMDDHHMMSS>_<module>_<mô tả>/migration.sql` (chỉ ADD), chạy `npx prisma migrate deploy` + `npx prisma generate`, và ghi trong báo cáo. Đừng động vào migration của người khác.
- TUYỆT ĐỐI không chạy seed/migrate reset lên schema `public` của DB dev `sofinhub` (người điều phối làm ở cuối). Để thử seed của bạn: dùng `useTestDb()` trong một script/test tạm hoặc trỏ `DATABASE_URL` sang schema riêng `...?schema=scratch_<module>` sau khi `migrate deploy`, rồi dọn schema đó.
- Tool Bash hay lỗi parse với heredoc dài/nhiều dấu nháy → dùng Write/Edit; Bash chỉ cho lệnh ngắn. Không đụng `frontend/`. Không commit.
- `npm run typecheck` (và `npx tsc -p tsconfig.tools.json`) sạch; chạy test của module bạn (`node --import tsx --test tests/<file>.test.ts`); các agent khác đang sửa module khác nên lỗi tsc/test ngoài phạm vi thì bỏ qua/chờ, đừng sửa hộ.
- Seed phải tạo dữ liệu có ý nghĩa cho TEST THỦ CÔNG (xem `prisma/seed-accounts.ts`: các tài khoản admin/owner/cadmin/mod/member1..3/newbie/banned + cộng đồng photo/yt/fin do owner làm chủ). Nghĩa là ngoài dữ liệu demo cho mọi cộng đồng, hãy tạo thêm kịch bản gắn với các tài khoản test đó ở cộng đồng `photo` (bài viết của member1, một bài bị ẩn, một báo cáo đang chờ, sự kiện sắp tới có member2 đã RSVP...) phù hợp module của bạn, và LIỆT KÊ chúng trong báo cáo cuối (người lập tài liệu test thủ công sẽ dựa vào đó).

## Tài liệu
Cập nhật phần liên quan trong `DATABASE.md` (bảng nào thuộc module nào, quyết định mapping, phần seed) và `docs/api/<nhóm>.md` nếu hành vi đổi. Ghi báo cáo cuối: đã chuyển gì, quyết định, seed tạo gì (kịch bản), test còn đỏ (nếu có), file ngoài phạm vi đã sửa, cột/migration đã thêm.
