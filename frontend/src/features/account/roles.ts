import type { MemberRole, PointReason } from './types';

export const ROLE_LABEL: Record<MemberRole, string> = {
  member: 'Thành viên',
  mod: 'Điều hành viên',
  admin: 'Quản trị viên',
  owner: 'Chủ cộng đồng',
};

export const REASON_LABEL: Record<PointReason, string> = {
  post: 'Đăng bài viết',
  like_received: 'Được thích bài viết',
  lesson_complete: 'Hoàn thành bài học',
  event_rsvp: 'Đăng ký sự kiện',
};

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN');
