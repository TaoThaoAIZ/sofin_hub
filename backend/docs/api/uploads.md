# API Upload file

Module: `src/modules/uploads/`. Tất cả đường dẫn nằm dưới tiền tố `/api`. Test: `tests/uploads.test.ts`.

## Endpoint

| Method | Path | Auth | Body / Query | Response | Lỗi |
|---|---|---|---|---|---|
| POST | `/uploads/presign` | Bearer | `{filename, contentType, size, purpose, courseId?}` | 201 `{data:{uploadUrl, method:'PUT', headers, fileUrl, key, expiresAt}}` | 400 (loại file/dung lượng/purpose), 401, 403 (lesson_attachment + courseId mà không phải mod+), 404 (courseId), 413 (vượt hạn mức) |
| PUT | `/uploads/:key?token=...` | Vé HMAC trong query (không cần Bearer) | Body thô, header `Content-Type` = loại đã presign | `{data:{key,fileUrl,size,contentType}}` | 400 (Content-Type lệch, magic bytes sai, rỗng), 401 (vé sai/hết hạn/đã dùng), 403 (vé không khớp key), 404, 413 |
| GET | `/files/:key` | Ảnh công khai (`avatar/cover/post_image`): không cần. File riêng tư: Bearer HOẶC `?u=&exp=&sig=` (URL ký) | - | Stream file | 401 (riêng tư, thiếu/sai/hết hạn chữ ký), 403 (không có quyền), 404 (không có bản ghi Upload, `status != uploaded`, đã gỡ/thu hồi) |
| POST | `/files/:key/url` | Bearer | - | 200 `{data:{url, expiresAt}}`: ảnh công khai -> URL thường, `expiresAt:null`; file riêng tư -> URL ký, hạn 300s | 401, 403, 404 |
| GET | `/me/uploads` | Bearer | - | `{data:[{key,url,filename,contentType,size,purpose,createdAt}]}` | 401 |
| DELETE | `/uploads/:key` | Bearer, chủ sở hữu hoặc Platform Admin | - | `{data:{deleted:true}}` | 401, 403, 404 |

`purpose`: `post_image | post_file | avatar | cover | lesson_attachment | message_attachment`.

## Luồng dùng

1. FE gọi `POST /uploads/presign` -> nhận `uploadUrl` (đường dẫn tương đối `/api/uploads/...`, FE ghép với origin API).
2. FE `PUT uploadUrl` với đúng `headers` (Content-Type) và body là file.
3. Dùng `fileUrl` (`/api/files/<key>`) để hiển thị/lưu vào bài viết, avatar, tin nhắn...

## Whitelist và giới hạn (mặc định, chỉnh trong `.env`)

| purpose | Loại cho phép | Tối đa |
|---|---|---|
| post_image | jpeg, png, webp, gif | `UPLOAD_MAX_IMAGE_MB` = 5MB |
| avatar | ảnh | `UPLOAD_MAX_AVATAR_MB` = 3MB |
| cover | ảnh | `UPLOAD_MAX_COVER_MB` = 8MB |
| post_file, lesson_attachment | pdf, zip, docx, xlsx, pptx, ppsx, doc, ppt, xls, txt, csv, mp4 | `UPLOAD_MAX_FILE_MB` = 25MB |
| message_attachment | ảnh + pdf, zip, docx, xlsx, pptx, ppsx, doc, ppt, xls, txt, csv | 25MB |
| **lesson_video** | mp4, webm, mov (H.264) | `UPLOAD_MAX_VIDEO_MB` = **2048MB**, upload dạng **stream** |
| **lesson_slide** | pdf, ppt, pptx, ppsx | `UPLOAD_MAX_SLIDE_MB` = 200MB, upload dạng **stream** |

**lesson_video / lesson_slide** (video dài, slide lớn):
- Chỉ mod+ của cộng đồng (`communityId` bắt buộc); thành viên cộng đồng mới xem được. Slide lưu trong `attachments` của bài với `kind: "slide"` (không cần cột mới).
- `PUT /uploads/:key` **bắt buộc có Content-Length** (thiếu = 411). Backend KHÔNG nạp cả file vào RAM: kiểm magic bytes ở khúc đầu, đếm byte (vượt vé = 413, lệch Content-Length = 400) rồi ghi thẳng xuống kho (đĩa: `createWriteStream`; S3: `PutObject` stream, tối đa 5GB). Lỗi giữa chừng thì dọn file dở và hủy yêu cầu.
- `GET /files/:key` hỗ trợ **Range** (206/416, `Accept-Ranges: bytes`) để tua video; URL ký của lesson_video sống **4 giờ** (video dài), file khác 300s.
- Node `server.requestTimeout` = 3 giờ (mặc định 300s sẽ cắt video lớn trên mạng chậm).
- **NGINX trên server phải cho body lớn** cho đường dẫn upload: trong `/opt/app/nginx/default.conf` thêm `location /api/uploads/ { client_max_body_size 2100m; proxy_request_buffering off; proxy_read_timeout 3h; proxy_send_timeout 3h; ... }` (mẫu đầy đủ ở `deploy/aws/nginx/default.conf` và `https.conf.example`). `remote-deploy.sh` KHÔNG ghi đè file này nên phải sửa tay một lần rồi `docker compose up -d --build web`. Hạn mức lưu trữ mỗi người `UPLOAD_USER_QUOTA_MB` mặc định nâng lên 10240MB.

Hạn mức mỗi người: `UPLOAD_USER_QUOTA_MB` = 200MB (tính file đã upload + yêu cầu presign còn hạn). SVG và HTML KHÔNG có trong whitelist (chống XSS).

## Quyết định thiết kế

- **Khóa file**: `randomBytes(16).hex + '.' + đuôi whitelist`. Tên file người dùng chỉ lưu làm metadata (đã bỏ ký tự điều khiển, `/`, `\`), KHÔNG bao giờ thành đường dẫn. `GET /files/:key` và storage đều kiểm tra khóa bằng regex `^[a-f0-9]{32}\.[a-z0-9]{2,5}$` nên `../` luôn 404.
- **Vé PUT**: `base64url(JSON{key,contentType,maxSize,userId,exp,nonce}).HMAC-SHA256` (bí mật `UPLOAD_SIGNING_SECRET`), TTL `UPLOAD_TICKET_TTL_SEC` = 600s, dùng 1 lần (nonce lưu trong bộ nhớ, chỉ bị tiêu khi mọi ràng buộc header đã đạt). `maxSize` = dung lượng khai báo lúc presign.
- **Đọc body**: `express.raw` riêng cho route PUT với `limit = maxSize` của vé, vượt -> 413 trước khi ghi. Ghi ra `*.part` rồi đổi tên để không phục vụ file dở.
- **Magic bytes**: kiểm tra chữ ký đầu file cho ảnh, pdf, zip/office, mp4; txt không được chứa byte NUL. Lỗi thì hủy yêu cầu upload (không lưu).
- **Phục vụ file**: Content-Type suy từ đuôi (không tin metadata), `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cross-Origin-Resource-Policy: cross-origin` (helmet mặc định là same-origin sẽ chặn FE khác origin). Ảnh: inline + `Cache-Control: public, max-age=31536000, immutable`; file khác: `Content-Disposition: attachment` + `private, max-age=3600`.
- **Hai lớp phục vụ file (audit 4.3)**:
  - *Công khai*: `avatar`, `cover`, `post_image` - ai có URL cũng xem được (cho `<img>`), cache dài như trên.
  - *Riêng tư*: `message_attachment`, `lesson_attachment`, `post_file` - luôn `Cache-Control: private, no-store`. Quyền (`uploads.access.ts#canReadPrivateFile`): chủ file và Platform Admin; `message_attachment` = 2 người của cuộc trò chuyện chứa tin nhắn CÒN SỐNG; `lesson_attachment` = thành viên khóa học gắn với file (`Upload.courseId`; không có courseId thì chỉ chủ file); `post_file` = thành viên của ít nhất một cộng đồng chung với chủ file.
  - *Cách xem*: gọi `GET /files/:key` kèm Bearer, hoặc xin `POST /files/:key/url` rồi dùng URL ký (`?u=<userId>&exp=<epoch giây>&sig=HMAC-SHA256(UPLOAD_SIGNING_SECRET, "file|key|userId|exp")`, hạn 300s) cho `<img>`/`<a href>`. Quyền được kiểm lại ở MỖI lần GET (không chỉ lúc cấp URL) nên bị kick/thu hồi tin nhắn là hết xem được ngay.
  - File không có bản ghi `Upload`, hoặc `status != uploaded`, hoặc đã bị admin gỡ -> 404 (kể cả khi file còn trên đĩa).
  - **Thu hồi tin nhắn** (`DELETE /messages/:id`) xóa luôn file đính kèm (đĩa + bản ghi) nếu không còn tin nhắn sống nào khác dùng lại; mọi URL (kể cả URL ký còn hạn) trả 404.
- **lesson_attachment**: nếu gửi `courseId` thì phải là mod trở lên (`requireRole`); nếu không gửi `courseId` thì không kiểm tra vai trò (theo yêu cầu "courseId tùy chọn").

## Lưu file ở S3 (đã hiện thực)

Đặt `S3_BUCKET` (và `S3_REGION`) thì `uploads.storage.ts` dùng `S3Storage`; bỏ trống thì dùng `LocalDiskStorage` như cũ (dev/test không cần AWS).

- **Luồng upload TRỰC TIẾP (mặc định khi có `S3_BUCKET`)**: FE `POST /uploads/presign` -> nhận `mode:'direct'` -> PUT **thẳng lên S3** (không qua backend) -> `POST /uploads/:key/complete` để backend xác nhận. File < 32MB: một presigned PUT. File ≥ 32MB (video/slide): **multipart** — FE chia phần 16MB, PUT 4 phần song song, mỗi phần thử lại 3 lần, rồi gửi `{uploadId, parts:[{partNumber, etag}]}` cho `complete`. `complete` ghép phần, kiểm dung lượng thật = khai báo, đọc 64 byte đầu (Range) kiểm magic bytes; sai thì xóa object + bản ghi. Lỗi/hủy: FE gọi `POST /uploads/:key/abort` để dọn. Không dùng S3 (đĩa local) thì giữ luồng vé HMAC qua backend (`mode:'proxy'`). URL presigned sống 2 giờ (bị giới hạn thêm bởi thời hạn credential của IAM role). `GET /api/files/:key` vẫn kiểm quyền qua backend; bucket vẫn **private**.
- **Cấu hình bucket bắt buộc** (nếu thiếu, trình duyệt báo lỗi mạng/thiếu ETag):
  - CORS: `AllowedOrigins` = origin FE (vd. `https://app.sofinhub.com`, thêm `http://localhost:5173` khi dev), `AllowedMethods` = `PUT`, `AllowedHeaders` = `*`, **`ExposeHeaders` = `ETag`** (bắt buộc cho multipart), `MaxAgeSeconds` = 3000.
  - Lifecycle: rule *Abort incomplete multipart uploads* sau 1 ngày (dọn phần mồ côi nếu người dùng đóng tab giữa chừng).
  - IAM role của backend cần thêm `s3:AbortMultipartUpload`, `s3:ListMultipartUploadParts` (ngoài Get/Put/Delete).
- **Phát video (lesson_video) trên S3**: `POST /files/:key/url` trả **URL presigned GET của S3** (hạn 2 giờ) sau khi kiểm quyền thành viên, nên trình duyệt tải/tua thẳng từ S3 (Range do S3 xử lý), không đi qua backend và không tốn truy vấn DB ở từng Range. Đĩa local vẫn dùng URL ký qua backend. FE (`LessonPage`) tự xin URL mới 1 lần nếu URL hết hạn giữa chừng. Đánh đổi: URL S3 không thu hồi được trong 2 giờ (người bị kick vẫn xem được tới khi URL hết hạn). Mẹo tăng tốc bắt đầu phát: encode mp4 với `-movflags +faststart` (đưa moov atom lên đầu file) để không phải tải đoạn cuối trước.
- **Credentials**: chuỗi mặc định của AWS SDK, tức IAM role gắn vào EC2/ECS. Không đặt access key vào `.env`. Role chỉ cần `s3:GetObject/PutObject/DeleteObject` trên `arn:aws:s3:::<bucket>/*` và `s3:ListBucket` trên bucket. Chạy trong Docker trên EC2 thì instance metadata phải có `HttpPutResponseHopLimit=2`, nếu không container không lấy được credentials.
- **Lỗi**: `NoSuchKey/NotFound` -> 404; lỗi khác (AccessDenied, mạng) được ném lên thành 500 để không che sai cấu hình IAM.
- Test: `tests/uploads.s3.test.ts` (client giả, không cần AWS).
- Chưa làm: presigned GET trực tiếp (tải về vẫn qua backend), CloudFront, chuyển file cũ từ ổ đĩa sang S3 (copy tay `UPLOAD_DIR/*` lên bucket với cùng tên key là đủ vì bản ghi `Upload` giữ nguyên).

## Giới hạn hiện tại / Chưa làm

- Metadata (bảng `Upload`: chủ sở hữu, key, size, contentType, purpose, status) bền vững; hạn mức mỗi user = một truy vấn `SUM(size)` (file `uploaded` + `pending` còn trong TTL vé). File vẫn trên ổ đĩa qua `StorageProvider` (khi sang S3 chỉ đổi provider; metadata giữ nguyên). Chỉ `lesson_attachment` lưu `courseId` (đã kiểm tra khóa học tồn tại).
- Nonce vé PUT (dùng 1 lần) được đánh dấu bằng `SET NX PX` (atomic, TTL tới hạn vé) ở state chia sẻ: hai PUT đua nhau cùng vé chỉ một bên qua, kể cả giữa các instance và sau restart khi có Redis (`REDIS_URL`); không Redis thì in-memory (mất khi restart nhưng dòng `Upload` hết `pending` vẫn chặn phát lại). Lỗi store => từ chối (fail-closed). Presign song song có thể vượt hạn mức chút ít (không khóa).
- Chưa dọn file "mồ côi" (presign nhưng không PUT chỉ chiếm chỗ hạn mức đến hết TTL; file không còn được tham chiếu chưa bị xóa).
- Chưa hỗ trợ HTTP Range (xem video mp4 tua được), chưa quét virus, chưa tạo thumbnail/resize, chưa kiểm tra sâu nội dung ảnh (chỉ magic bytes).
- Chưa rate-limit riêng cho presign.
- `data/uploads/` nằm trong `.gitignore`; trên ECS/EC2 cần gắn volume bền vững hoặc chuyển sang S3.
- FE: `frontend/src/lib/files.ts` (`useFileUrl`, `openFile`) xin URL ký cho file tin nhắn / tài liệu bài học / xem trước trong Admin. Link `post_file` nằm dạng văn bản trong nội dung bài viết nên người đọc chưa bấm trực tiếp được (cần trường tệp đính kèm cho bài viết, xem API.md).
