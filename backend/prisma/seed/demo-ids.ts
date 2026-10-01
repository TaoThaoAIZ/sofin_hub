/**
 * Danh tính thành viên minh họa (User.isDemo=true) DÙNG CHUNG cho mọi file seed nội dung.
 * Id xác định: `demo-<communityId>-<i>` (i = 0..DEMO_NAMES.length-1); email `seed-<communityId>-<i>@demo.sofinhub.invalid`.
 * Thành viên i=0 là quản trị viên minh họa (role admin) của cộng đồng đó. Do agent `communities` tạo User + Enrollment
 * thật trong prisma/seed/demo-members.ts (chạy TRƯỚC các seed nội dung khác); các seed khác chỉ tham chiếu id này.
 */
export const DEMO_NAMES: readonly string[] = [
  'Tom Be', 'Michial Kekv', 'Tran Trong', 'Linh Trần', 'Tai Do', 'Thuy Le', 'Nguyen Nam', 'Le Hồng', 'Anh Thanh Nien Tre',
  'Ngọc Vũ', 'Ha Giang', 'Nong giang Thuyen', 'Duy Vi', 'Bui Trương', 'Đoàn Thành', 'Nguyen Ba kien', 'Thi Vãn', 'Hoang Long',
  'Đặng Nhật Hoàng', 'Phan Hải', 'Hoàng Nam', 'Hai Nguyen', 'Miu Lee', 'Minh Quang', 'Việt Anh Huỳnh', 'Le Minh',
  'Nguyễn Công Sỹ', 'Mạnh Vương', 'Anh Luu', 'Duong Duong', 'Quang Hung', 'Tuấn Anh Nguyễn', 'Trí Xuân', 'Kim Chi',
  'Hồng Phúc', 'Bảo Ngọc', 'Thành Đạt', 'Mai Phương', 'Quốc Việt', 'Thu Trang', 'Gia Hân', 'Đức Minh', 'Khánh Vy',
  'Hữu Tài', 'Yến Nhi', 'Công Danh', 'Ánh Tuyết', 'Bích Ngọc', 'Xuân Mai', 'Trung Kiên', 'Lan Anh', 'Hải Yến',
  'Văn Toàn', 'Diệu Linh', 'Nhật Minh', 'Phương Thảo', 'Tiến Dũng', 'Cẩm Tú', 'Đình Khôi', 'Thanh Tùng',
];

export const demoUserId = (communityId: string, i: number) => `demo-${communityId}-${i}`;
export const demoEmail = (communityId: string, i: number) => `seed-${communityId}-${i}@demo.sofinhub.invalid`;
