/** Đường dẫn chuẩn (canonical) của FE. Mọi URL cũ `/courses/:id/...` vẫn hoạt động qua <LegacyCourseRedirect/>. */
export const communityHome = (id: string, sub = '') => `/communities/${id}/community${sub ? `/${sub}` : ''}`;
export const communityDetail = (id: string) => `/communities/${id}`;
export const communityCheckout = (id: string) => `/communities/${id}/checkout`;
export const communitySettings = (id: string) => communityHome(id, 'cai-dat');
export const classroomPath = (id: string, courseId?: string | null) =>
  `${communityHome(id, 'lop-hoc')}${courseId ? `?khoa=${encodeURIComponent(courseId)}` : ''}`;
export const lessonPath = (id: string, lessonId: string) => communityHome(id, `lop-hoc/${lessonId}`);
