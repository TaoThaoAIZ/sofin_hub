/**
 * Trần số trang cho mọi endpoint phân trang kiểu OFFSET (`?page=`): `?page=1000000` bắt Postgres quét/bỏ qua hàng triệu dòng (DoS rẻ).
 * Vượt trần → 400 từ zod. Cần duyệt sâu hơn thì dùng bộ lọc/tìm kiếm (hoặc chuyển sang cursor).
 */
export const MAX_PAGE = 1000;
