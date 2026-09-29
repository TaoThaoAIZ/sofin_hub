# QA — bộ testcase SofinHub

`SofinHub_TestCases.xlsx` (gốc repo) được SINH bằng script, đừng sửa tay dữ liệu testcase trong xlsx (sửa tay chỉ ở các cột kết quả M..R).

| File | Vai trò |
|---|---|
| `gen_testcases.py` | Điểm vào. Chứa testcase cũ (HOME, AUTH, COMM, COMMVP, COURSE, FEED, MEMBER, EVENT, NOTI, PAY, ADMIN, SEC, ROLE, INTEG), danh sách case cũ vẫn "Kế hoạch" (`STILL_PLAN_OLD`), nạp `cases_*.py`, kiểm tra dữ liệu, dựng sheet Tổng quan + Test Cases. |
| `cases_auth.py` `cases_community.py` `cases_content.py` `cases_classroom.py` `cases_payments.py` `cases_comms.py` `cases_platform.py` | Testcase đợt 30/09/2026, mỗi file có `load(add)`. Thêm case mới = thêm `add(...)` CUỐI file (giữ nguyên thứ tự để mã TC-xxx-nnn không đổi). Tham số `pw` = "Có/Một phần/Không" quyết định phần Test 1 (Playwright + bằng chứng) hay Test 2 (thủ công). |
| `sheets_extra.py` | Sheet "Tài khoản & dữ liệu test" và "Nhật ký thay đổi" (sửa khi seed BE đổi). |
| `apply_playwright_results.py` | Ghi kết quả `e2e/parsed_results.json` vào cột Test 1. |
| `embed_evidence_images.py` | Nhúng ảnh `e2e/evidence/*.png` vào sheet "Bằng chứng (ảnh)". |

## Sinh lại xlsx

```bash
python qa/gen_testcases.py              # sinh xlsx + tự chạy apply_playwright_results + embed_evidence_images (nếu có e2e/parsed_results.json)
python qa/gen_testcases.py --no-results # chỉ sinh xlsx, không ghi kết quả/ảnh Playwright
python qa/gen_testcases.py --no-restore # không khôi phục cột kết quả M..R từ xlsx cũ
```

Trên Windows nếu console lỗi mã hóa: `set PYTHONIOENCODING=utf-8` trước khi chạy.

## Kết quả đã nhập có bị mất không?

Script đọc xlsx cũ trước khi ghi đè và KHÔI PHỤC các cột M..R (người test, trạng thái, evidence, ghi chú) theo mã TC + tiêu đề trùng khớp. Case bị đổi tiêu đề thì không khôi phục (in số lượng ra console). Mã TC ổn định nhờ quy tắc: case mới luôn thêm cuối mỗi module; KHÔNG chèn giữa hoặc đổi thứ tự case cũ. Nên sao lưu xlsx (git) trước khi sinh lại. File xlsx đang mở trong Excel sẽ làm lệnh lưu thất bại — đóng file trước.

## Quy ước "mô hình hai người test"

Mỗi dòng có cột "Phù hợp Playwright": **Có** = Test 1 tự động (Playwright + ảnh bằng chứng) và Test 2 chạy thủ công đối chiếu; **Một phần** = Test 1 làm phần tự động được, Test 2 xác minh phần còn lại; **Không** = chỉ Test 2 (thủ công). Cột `Người test 1/Trạng thái test 1/Evidences` do `apply_playwright_results.py` điền; `Người test 2/Trạng thái test 2` điền tay.

Môi trường & tài khoản test: xem sheet "Tài khoản & dữ liệu test".


## Cấu trúc workbook (từ 2026-09-30)
- `Tổng quan`: thống kê + bảng module có liên kết nhảy tới từng sheet, cột tiến độ Pass/Fail/Chưa test (công thức đếm trên từng sheet module).
- **17 sheet module** (`HOME`, `AUTH`, `COMM`, `COMMVP`, `COURSE`, `CERT`, `FEED`, `MEMBER`, `EVENT`, `NOTI`, `SEARCH`, `UPLOAD`, `PAY`, `ADMIN`, `ROLE`, `SEC`, `INTEG`): mỗi module một sheet, cùng 18 cột A..R (A1 = "Mã Test Case", B1 = "Module"). Việc tách do `split_sheets.py` thực hiện sau khi `gen_testcases.py` dựng dữ liệu vào một sheet tạm; sheet tạm bị xóa.
- `Tài khoản & dữ liệu test`, `Nhật ký thay đổi`, `Bằng chứng (ảnh)`.
- Các script khác (`apply_playwright_results.py`, khôi phục kết quả khi sinh lại) nhận diện sheet testcase bằng A1 = "Mã Test Case" và B1 = "Module" (sheet Bằng chứng có A1 giống nhưng B1 khác) nên chạy được với cả file cũ (1 sheet "Test Cases") lẫn file mới.
- Thêm module mới: thêm mã vào `SHORT_NAMES` và `ORDER` trong `split_sheets.py` (nếu quên, sheet vẫn được tạo, đặt cuối với tên module đầy đủ).
