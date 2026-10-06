import { apiDelete, apiDownload, apiGet, apiPatch, apiPost, apiPut } from '../../lib/api';
import type {
  Certificate,
  CertificateVerification,
  ClassroomLesson,
  ClassroomModule,
  Comment,
  CommunityEvent,
  CourseInput,
  CourseProgress,
  LearningCourse,
  CreatePostInput,
  LessonDetail,
  LessonInput,
  ModuleAccessMember,
  ModuleInput,
  PostQuery,
  PostShare,
  Report,
  ReportAction,
  ReportReason,
  ReportStatus,
  TagCount,
  UpdateEventInput,
  UpdatePostInput,
  LeaderboardRow,
  LeaderboardWindow,
  LevelsResponse,
  MemberFilter,
  MemberList,
  Paginated,
  Post,

} from './types';

// ---- Bảng tin ----
export const fetchPosts = (
  courseId: string,
  query: PostQuery,
  token: string,
  signal?: AbortSignal,
) => apiGet<Paginated<Post>>(`/communities/${courseId}/posts`, query, signal, { token });

export const createPost = (courseId: string, body: CreatePostInput, token: string) =>
  apiPost<{ data: Post }>(`/communities/${courseId}/posts`, body, { token }).then((r) => r.data);

export const toggleLike = (postId: string, token: string) =>
  apiPost<{ data: { liked: boolean; likesCount: number } }>(`/posts/${postId}/like`, undefined, { token }).then((r) => r.data);

export const togglePin = (postId: string, token: string) =>
  apiPost<{ data: { pinned: boolean } }>(`/posts/${postId}/pin`, undefined, { token }).then((r) => r.data);

/** Backend phân trang keyset (mặc định 100/lần): gom các trang liên tiếp (tối đa 10 trang). */
export async function fetchComments(postId: string, token: string, signal?: AbortSignal): Promise<Comment[]> {
  const out: Comment[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 10; i++) {
    const r = await apiGet<{ data: Comment[]; meta?: { nextCursor?: string | null } }>(`/posts/${postId}/comments`, { limit: 200, cursor }, signal, { token });
    out.push(...r.data);
    cursor = r.meta?.nextCursor ?? undefined;
    if (!cursor) break;
  }
  return out;
}

export const createComment = (postId: string, content: string, token: string) =>
  apiPost<{ data: Comment }>(`/posts/${postId}/comments`, { content }, { token }).then((r) => r.data);

// ---- Lịch sự kiện ----
export const fetchEvents = (courseId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: CommunityEvent[] }>(`/communities/${courseId}/events`, undefined, signal, { token }).then((r) => r.data);

export const createEvent = (
  courseId: string,
  body: { title: string; description: string; startAt: string; timezone: string; meetingLink?: string; capacity?: number },
  token: string,
) => apiPost<{ data: CommunityEvent }>(`/communities/${courseId}/events`, body, { token }).then((r) => r.data);

export const toggleRsvp = (eventId: string, token: string) =>
  apiPost<{ data: { rsvped: boolean; rsvpCount: number } }>(`/events/${eventId}/rsvp`, undefined, { token }).then((r) => r.data);

// ---- Thành viên ----
export const fetchMembers = (
  courseId: string,
  query: { q?: string; page?: number; filter?: MemberFilter; sort?: 'active' | 'joined' },
  token: string,
  signal?: AbortSignal,
) => apiGet<MemberList>(`/communities/${courseId}/members`, query, signal, { token });

// ---- Bảng xếp hạng ----
export const fetchLeaderboard = (courseId: string, window: LeaderboardWindow, token: string, signal?: AbortSignal) =>
  apiGet<{ data: LeaderboardRow[] }>(`/communities/${courseId}/leaderboard`, { window }, signal, { token }).then((r) => r.data);

export const fetchLevels = (courseId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: LevelsResponse }>(`/communities/${courseId}/levels`, undefined, signal, { token }).then((r) => r.data);

// ==== Nhóm nội dung mở rộng: bài viết ====
const D = <T>(r: { data: T }) => r.data;

export const fetchPost = (postId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: Post }>(`/posts/${postId}`, undefined, signal, { token }).then(D);
export const fetchPostShare = (postId: string, token: string) =>
  apiGet<{ data: PostShare }>(`/posts/${postId}/share`, undefined, undefined, { token }).then(D);
export const updatePost = (postId: string, body: UpdatePostInput, token: string) =>
  apiPatch<{ data: Post }>(`/posts/${postId}`, body, { token }).then(D);
export const deletePost = (postId: string, token: string) => apiDelete<{ data: { deleted: boolean } }>(`/posts/${postId}`, { token }).then(D);
export const setPostHidden = (postId: string, hidden: boolean, token: string) =>
  apiPost<{ data: { hidden: boolean } }>(`/posts/${postId}/${hidden ? 'hide' : 'unhide'}`, undefined, { token }).then(D);
export const votePoll = (postId: string, optionIds: string[], token: string) =>
  apiPost<{ data: Post }>(`/posts/${postId}/poll/vote`, { optionIds }, { token }).then(D);
export const fetchTags = (courseId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: TagCount[] }>(`/communities/${courseId}/tags`, undefined, signal, { token }).then(D);
export const updateComment = (commentId: string, content: string, token: string) =>
  apiPatch<{ data: Comment }>(`/comments/${commentId}`, { content }, { token }).then(D);
export const deleteComment = (commentId: string, token: string) =>
  apiDelete<{ data: { deleted: boolean } }>(`/comments/${commentId}`, { token }).then(D);

// ==== Kiểm duyệt ====
export const reportTarget = (kind: 'posts' | 'comments', id: string, body: { reason: ReportReason; detail?: string }, token: string) =>
  apiPost<{ data: Report }>(`/${kind}/${id}/report`, body, { token }).then(D);
export const fetchReports = (courseId: string, query: { status?: ReportStatus; page?: number }, token: string, signal?: AbortSignal) =>
  apiGet<Paginated<Report>>(`/communities/${courseId}/reports`, query, signal, { token });
export const fetchAdminReports = (query: { status?: ReportStatus; page?: number }, token: string, signal?: AbortSignal) =>
  apiGet<Paginated<Report>>(`/admin/reports`, query, signal, { token });
export const resolveReport = (reportId: string, body: { action: ReportAction; note?: string }, token: string) =>
  apiPatch<{ data: Report }>(`/reports/${reportId}`, body, { token }).then(D);

// ==== Sự kiện mở rộng ====
export const updateEvent = (eventId: string, body: UpdateEventInput, token: string) =>
  apiPatch<{ data: CommunityEvent }>(`/events/${eventId}`, body, { token }).then(D);
export const deleteEvent = (eventId: string, token: string) =>
  apiDelete<{ data: { deleted: boolean } }>(`/events/${eventId}`, { token }).then(D);
export const cancelRsvp = (eventId: string, token: string) =>
  apiDelete<{ data: { rsvped: boolean; rsvpCount: number } }>(`/events/${eventId}/rsvp`, { token }).then(D);
export const downloadEventIcs = (eventId: string, token: string) => apiDownload(`/events/${eventId}/ics`, `su-kien-${eventId}.ics`, { token });
export const downloadCommunityIcs = (courseId: string, token: string) => apiDownload(`/communities/${courseId}/events.ics`, `lich-cong-dong-${courseId}.ics`, { token });

// ==== Lớp học: khóa học (Course) nằm trong cộng đồng ====
// `cid` = id cộng đồng, `courseId` = id khóa học (uuid). Route cũ /courses/:id/* vẫn chạy ở BE nhưng FE dùng route chuẩn.
const cBase = (cid: string, courseId: string) => `/communities/${cid}/courses/${courseId}`;

export const fetchCourseList = (cid: string, token: string, signal?: AbortSignal, status?: string) =>
  apiGet<{ data: LearningCourse[] }>(`/communities/${cid}/courses`, status ? { status } : undefined, signal, { token }).then(D);
export const createCourse = (cid: string, body: CourseInput, token: string) =>
  apiPost<{ data: LearningCourse }>(`/communities/${cid}/courses`, body, { token }).then(D);
export const updateCourse = (cid: string, courseId: string, body: Partial<CourseInput> & { certificatesEnabled?: boolean | null }, token: string) =>
  apiPatch<{ data: LearningCourse }>(cBase(cid, courseId), body, { token }).then(D);
export const archiveCourse = (cid: string, courseId: string, token: string) =>
  apiPost<{ data: LearningCourse }>(`${cBase(cid, courseId)}/archive`, undefined, { token }).then(D);
export const deleteCourse = (cid: string, courseId: string, token: string) =>
  apiDelete<{ data: { deleted: boolean } }>(cBase(cid, courseId), { token }).then(D);
export const reorderCourses = (cid: string, ids: string[], token: string) =>
  apiPut<{ data: LearningCourse[] }>(`/communities/${cid}/courses/order`, { ids }, { token }).then(D);

export const fetchModules = (cid: string, courseId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: ClassroomModule[] }>(`${cBase(cid, courseId)}/modules`, undefined, signal, { token }).then(D);
export const fetchLessons = (cid: string, courseId: string, moduleId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: ClassroomLesson[] }>(`${cBase(cid, courseId)}/modules/${moduleId}/lessons`, undefined, signal, { token }).then(D);
export const fetchProgress = (cid: string, courseId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: CourseProgress }>(`${cBase(cid, courseId)}/progress`, undefined, signal, { token }).then(D);
export const fetchCertificate = (cid: string, courseId: string, token: string) =>
  apiGet<{ data: Certificate }>(`${cBase(cid, courseId)}/certificate`, undefined, undefined, { token }).then(D);
export const createModule = (cid: string, courseId: string, body: ModuleInput, token: string) =>
  apiPost<{ data: ClassroomModule }>(`${cBase(cid, courseId)}/modules`, body, { token }).then(D);
export const updateModule = (cid: string, courseId: string, moduleId: string, body: Partial<ModuleInput>, token: string) =>
  apiPatch<{ data: ClassroomModule }>(`${cBase(cid, courseId)}/modules/${moduleId}`, body, { token }).then(D);
export const deleteModule = (cid: string, courseId: string, moduleId: string, token: string) =>
  apiDelete<{ data: { deleted: boolean } }>(`${cBase(cid, courseId)}/modules/${moduleId}`, { token }).then(D);
export const reorderModules = (cid: string, courseId: string, ids: string[], token: string) =>
  apiPut<{ data: ClassroomModule[] }>(`${cBase(cid, courseId)}/modules/order`, { ids }, { token }).then(D);
export const createLesson = (cid: string, courseId: string, moduleId: string, body: LessonInput, token: string) =>
  apiPost<{ data: ClassroomLesson }>(`${cBase(cid, courseId)}/modules/${moduleId}/lessons`, body, { token }).then(D);
export const reorderLessons = (cid: string, courseId: string, moduleId: string, ids: string[], token: string) =>
  apiPut<{ data: ClassroomLesson[] }>(`${cBase(cid, courseId)}/modules/${moduleId}/lessons/order`, { ids }, { token }).then(D);

// Theo id bài học (duy nhất toàn cục, hoạt động trên mọi khóa trong cộng đồng)
export const fetchLesson = (cid: string, lessonId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: LessonDetail }>(`/communities/${cid}/lessons/${lessonId}`, undefined, signal, { token }).then(D);
export const toggleLessonComplete = (cid: string, lessonId: string, token: string) =>
  apiPost<{ data: { completed: boolean } }>(`/communities/${cid}/lessons/${lessonId}/complete`, undefined, { token }).then(D);
export const updateLesson = (cid: string, lessonId: string, body: Partial<LessonInput>, token: string) =>
  apiPatch<{ data: ClassroomLesson }>(`/communities/${cid}/lessons/${lessonId}`, body, { token }).then(D);
export const deleteLesson = (cid: string, lessonId: string, token: string) =>
  apiDelete<{ data: { deleted: boolean } }>(`/communities/${cid}/lessons/${lessonId}`, { token }).then(D);

// Cài đặt mặc định của cộng đồng (khóa học có thể override bằng updateCourse.certificatesEnabled)
export const verifyCertificate = (code: string, signal?: AbortSignal) =>
  apiGet<{ data: CertificateVerification }>(`/certificates/${encodeURIComponent(code)}`, undefined, signal).then(D);
export const fetchClassroomSettings = (cid: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: { certificatesEnabled: boolean } }>(`/communities/${cid}/classroom-settings`, undefined, signal, { token }).then(D);
export const updateClassroomSettings = (cid: string, body: { certificatesEnabled: boolean }, token: string) =>
  apiPatch<{ data: { certificatesEnabled: boolean } }>(`/communities/${cid}/classroom-settings`, body, { token }).then(D);

export const fetchModuleAccess = (cid: string, courseId: string, moduleId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: ModuleAccessMember[] }>(`${cBase(cid, courseId)}/modules/${moduleId}/access`, undefined, signal, { token }).then(D);
export const setModuleAccess = (cid: string, courseId: string, moduleId: string, userIds: string[], token: string) =>
  apiPut<{ data: ModuleAccessMember[] }>(`${cBase(cid, courseId)}/modules/${moduleId}/access`, { userIds }, { token }).then(D);
