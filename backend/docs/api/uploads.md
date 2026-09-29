# API Upload file

Module: `src/modules/uploads/`. Tất cả đường dẫn nằm dưới tiền tố `/api`. Test: `tests/uploads.test.ts`.

## Endpoint

| Method | Path | Auth | Body / Query | Response | Lỗi |
|---|---|---|---|---|---|
| POST | `/uploads/presign` | Bearer | `{filename, contentType, size, purpose, courseId?}` | 201 `{data:{uploadUrl, method:'PUT', headers, fileUrl, key, expiresAt}}` | 400 (loại file/dung lượng/purpose), 401, 403 (lesson_attachment + courseId mà không phải mod+), 404 (courseId), 413 (vượt hạn mức) |
| PUT | `/uploads/:key?token=...` | Vé HMAC trong query (không cần Bearer) | Body thô, header `Content-Type` = loại đã presign | `{data:{key,fileUrl,size,contentType}}` | 400 (Content-Type lệch, magic bytes sai, rỗng), 401 (vé sai/hết hạn/đã dùng), 403 (vé không khớp key), 404, 413 |
| GET | `/files/:key` | Công khai | - | Stream file | 404 |
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
| post_file, lesson_attachment | pdf, zip, docx, xlsx, pptx, txt, mp4 | `UPLOAD_MAX_FILE_MB` = 25MB |
| message_attachment | ảnh + pdf, zip, docx, xlsx, pptx, txt | 25MB |

Hạn mức mỗi người: `UPLOAD_USER_QUOTA_MB` = 200MB (tính file đã upload + yêu cầu presign còn hạn). SVG và HTML KHÔNG có trong whitelist (chống XSS).

## Quyết định thiết kế

- **Khóa file**: `randomBytes(16).hex + '.' + đuôi whitelist`. Tên file người dùng chỉ lưu làm metadata (đã bỏ ký tự điều khiển, `/`, `\`), KHÔNG bao giờ thành đường dẫn. `GET /files/:key` và storage đều kiểm tra khóa bằng regex `^[a-f0-9]{32}\.[a-z0-9]{2,5}$` nên `../` luôn 404.
- **Vé PUT**: `base64url(JSON{key,contentType,maxSize,userId,exp,nonce}).HMAC-SHA256` (bí mật `UPLOAD_SIGNING_SECRET`), TTL `UPLOAD_TICKET_TTL_SEC` = 600s, dùng 1 lần (nonce lưu trong bộ nhớ, chỉ bị tiêu khi mọi ràng buộc header đã đạt). `maxSize` = dung lượng khai báo lúc presign.
- **Đọc body**: `express.raw` riêng cho route PUT với `limit = maxSize` của vé, vượt -> 413 trước khi ghi. Ghi ra `*.part` rồi đổi tên để không phục vụ file dở.
- **Magic bytes**: kiểm tra chữ ký đầu file cho ảnh, pdf, zip/office, mp4; txt không được chứa byte NUL. Lỗi thì hủy yêu cầu upload (không lưu).
- **Phục vụ file**: Content-Type suy từ đuôi (không tin metadata), `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cross-Origin-Resource-Policy: cross-origin` (helmet mặc định là same-origin sẽ chặn FE khác origin). Ảnh: inline + `Cache-Control: public, max-age=31536000, immutable`; file khác: `Content-Disposition: attachment` + `private, max-age=3600`.
- **Công khai theo URL**: `/files/:key` không cần đăng nhập để `<img>` dùng được; bảo mật dựa vào khóa 128-bit không đoán được (kiểu "unlisted link").
- **lesson_attachment**: nếu gửi `courseId` thì phải là mod trở lên (`requireRole`); nếu không gửi `courseId` thì không kiểm tra vai trò (theo yêu cầu "courseId tùy chọn").

## Nối S3/MinIO (chưa làm, đã chừa chỗ)

`uploads.storage.ts` định nghĩa `StorageProvider { createUploadTarget, put, getStream, delete, publicUrl }`. `S3Storage` hiện chỉ là khung ném lỗi "chưa cấu hình". Để nối:

1. Thêm `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`; env `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` (MinIO), `S3_PUBLIC_BASE_URL`.
2. `createUploadTarget`: `getSignedUrl(s3, new PutObjectCommand({Bucket, Key, ContentType, ContentLength: size}), {expiresIn})` -> trả `{uploadUrl: <url ký>, method:'PUT', headers:{'Content-Type': ct}}`. Nhớ ký kèm `ContentLength` và đặt CORS bucket cho origin FE.
3. `publicUrl`: `${S3_PUBLIC_BASE_URL}/${key}` (CloudFront) hoặc route `/files` redirect 302 sang URL ký GET.
4. Vì FE PUT thẳng lên S3, không còn bước `PUT /uploads/:key` nên cần xác nhận hoàn tất: thêm `POST /uploads/:key/complete` (HeadObject kiểm tra size/contentType, đánh dấu `uploaded`) hoặc lắng nghe S3 event. Magic bytes khi đó kiểm bằng cách đọc 16 byte đầu (Range GET).
5. Đổi `export const storage = new S3Storage(...)` theo `NODE_ENV`/env.

## Giới hạn hiện tại / Chưa làm

- Metadata (bảng `Upload`: chủ sở hữu, key, size, contentType, purpose, status) bền vững; hạn mức mỗi user = một truy vấn `SUM(size)` (file `uploaded` + `pending` còn trong TTL vé). File vẫn trên ổ đĩa qua `StorageProvider` (khi sang S3 chỉ đổi provider; metadata giữ nguyên). Chỉ `lesson_attachment` lưu `courseId` (đã kiểm tra khóa học tồn tại).
- Nonce vé PUT (dùng 1 lần) giữ trong bộ nhớ tiến trình: vé đã HMAC, sống ≤10 phút, và sau PUT thành công dòng `Upload` không còn `pending` nên phát lại vé bị 404; chỉ hai PUT SONG SONG cùng vé có thể lọt trên nhiều instance (cần Redis/bảng nếu muốn chặn tuyệt đối). Presign song song có thể vượt hạn mức chút ít (không khóa).
- Chưa dọn file "mồ côi" (presign nhưng không PUT chỉ chiếm chỗ hạn mức đến hết TTL; file không còn được tham chiếu chưa bị xóa).
- Chưa hỗ trợ HTTP Range (xem video mp4 tua được), chưa quét virus, chưa tạo thumbnail/resize, chưa kiểm tra sâu nội dung ảnh (chỉ magic bytes).
- Chưa rate-limit riêng cho presign.
- `data/uploads/` nằm trong `.gitignore`; trên ECS/EC2 cần gắn volume bền vững hoặc chuyển sang S3.
- Cần quyết định: `/files` có nên yêu cầu đăng nhập cho `message_attachment` (hiện công khai theo khóa).
