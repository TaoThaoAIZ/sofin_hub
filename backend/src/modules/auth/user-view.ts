import { userRepository } from './auth.repository.js';

export interface UserBriefView {
  id: string;
  name: string;
}

/** Tên hiển thị khi tài khoản đã bị xóa (nội dung cũ của họ vẫn được giữ lại). */
export const DELETED_USER_NAME = 'Thành viên đã xóa';

/** Tên hiển thị rút gọn cho 1 userId — dùng ở bảng tin, thành viên, bảng xếp hạng... */
export async function userBriefView(userId: string): Promise<UserBriefView> {
  const user = await userRepository.findById(userId);
  return { id: userId, name: user && !user.deletedAt ? `${user.firstName} ${user.lastName}` : DELETED_USER_NAME };
}
