# Tối ưu phát video bài học (S3)

## Vấn đề đã đo được (2026-10-20)
- Video mẫu trong S3: 126 giây nhưng 789MB (~50 Mbps), moov ở CUỐI file (không faststart). Máy đo chỉ tải ~2,4MB/s (~20Mbps) nên không phát liền mạch; mỗi lần tua mất ~1,2s chờ phản hồi từ S3 Sydney.

## Đã làm
- Tự chuyển mã bằng AWS MediaConvert: H.264 QVBR tối đa 6 Mbps + AAC 128k + moov ở đầu file. Video thử: 646MB -> 87,6MB (~5,6 Mbps), có faststart.
- Code: `backend/src/modules/uploads/video-optimize.ts`, `uploads.service.ts` (`ensureWebRendition`, `directReadUrl`). Video mới tự chuyển mã khi upload xong; video cũ tự tạo job ở lần đầu có người xem. Trong lúc chuyển mã vẫn phát bản gốc.
- Bản web nằm ở `web/<khóa không đuôi>.mp4` trong bucket; bản gốc giữ nguyên.
- Làm sớm cho video cũ: `docker compose exec backend npx tsx prisma/optimize-videos.ts` (cần `MEDIACONVERT_ROLE_ARN`).
- Hạ tầng đã tạo: IAM role `sofinhub-mediaconvert-role`; policy `mediaconvert-optimize` gắn vào `sofinhub-ec2-s3-role`; biến `MEDIACONVERT_ROLE_ARN` trong `/opt/app/.env`.

## Còn lại: CloudFront (giảm độ trễ mỗi lần tua)
- AWS đang chặn tạo distribution: "Your account must be verified before you can add new CloudFront resources" -> liên hệ AWS Support (https://console.aws.amazon.com/support/home) kèm đúng thông báo lỗi này.
- Đã tạo sẵn: public key `K2UUY2UYBHGB2Z`, key group `e6eac67a-2b7e-4bd8-9e74-5061985a25f2`, OAC `EM73UPYQOU30J` (private key tạm ở máy dev, chưa đưa lên server). Khi được xác minh: tạo distribution (origin = bucket + OAC, cache policy CachingOptimized, Trusted key group), thêm bucket policy cho CloudFront, rồi đổi `signedReadUrl` sang URL ký CloudFront.
