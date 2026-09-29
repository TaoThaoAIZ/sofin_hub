import { apiDelete, apiDownload, apiGet, apiPatch, apiPost, apiPut } from '../../lib/api';
import type {
  Certificate,
  CertificateVerification,
  ClassroomLesson,
  ClassroomModule,
  Comment,
  CommunityEvent,
  CourseProgress,
  CreatePostInput,
  LessonDetail,
  LessonInput,
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
) => apiGet<Paginated<Post>>(`/courses/${courseId}/posts`, query, signal, { token });

export const createPost = (courseId: string, body: CreatePostInput, token: string) =>
  apiPost<{ data: Post }>(`/courses/${courseId}/posts`, body, { token }).then((r) => r.data);

export const toggleLike = (postId: string, token: string) =>
  apiPost<{ data: { liked: boolean; likesCount: number } }>(`/posts/${postId}/like`, undefined, { token }).then((r) => r.data);

export const togglePin = (postId: string, token: string) =>
  apiPost<{ data: { pinned: boolean } }>(`/posts/${postId}/pin`, undefined, { token }).then((r) => r.data);

export const fetchComments = (postId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: Comment[] }>(`/posts/${postId}/comments`, undefined, signal, { token }).then((r) => r.data);

export const createComment = (postId: string, content: string, token: string) =>
  apiPost<{ data: Comment }>(`/posts/${postId}/comments`, { content }, { token }).then((r) => r.data);

// ---- Lớp học ----
export const fetchModules = (courseId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: ClassroomModule[] }>(`/courses/${courseId}/modules`, undefined, signal, { token }).then((r) => r.data);

export const fetchLessons = (courseId: string, moduleId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: ClassroomLesson[] }>(`/courses/${courseId}/modules/${moduleId}/lessons`, undefined, signal, { token }).then(
    (r) => r.data,
  );

export const toggleLessonComplete = (courseId: string, lessonId: string, token: string) =>
  apiPost<{ data: { completed: boolean } }>(`/courses/${courseId}/lessons/${lessonId}/complete`, undefined, { token }).then(
    (r) => r.data,
  );

// ---- Lịch sự kiện ----
export const fetchEvents = (courseId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: CommunityEvent[] }>(`/courses/${courseId}/events`, undefined, signal, { token }).then((r) => r.data);

export const createEvent = (
  courseId: string,
  body: { title: string; description: string; startAt: string; timezone: string; meetingLink?: string; capacity?: number },
  token: string,
) => apiPost<{ data: CommunityEvent }>(`/courses/${courseId}/events`, body, { token }).then((r) => r.data);

export const toggleRsvp = (eventId: string, token: string) =>
  apiPost<{ data: { rsvped: boolean; rsvpCount: number } }>(`/events/${eventId}/rsvp`, undefined, { token }).then((r) => r.data);

// ---- Thành viên ----
export const fetchMembers = (
  courseId: string,
  query: { q?: string; page?: number; filter?: MemberFilter; sort?: 'active' | 'joined' },
  token: string,
  signal?: AbortSignal,
) => apiGet<MemberList>(`/courses/${courseId}/members`, query, signal, { token });

// ---- Bảng xếp hạng ----
export const fetchLeaderboard = (courseId: string, window: LeaderboardWindow, token: string, signal?: AbortSignal) =>
  apiGet<{ data: LeaderboardRow[] }>(`/courses/${courseId}/leaderboard`, { window }, signal, { token }).then((r) => r.data);

export const fetchLevels = (courseId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: LevelsResponse }>(`/courses/${courseId}/levels`, undefined, signal, { token }).then((r) => r.data);

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
  apiGet<{ data: TagCount[] }>(`/courses/${courseId}/tags`, undefined, signal, { token }).then(D);
export const updateComment = (commentId: string, content: string, token: string) =>
  apiPatch<{ data: Comment }>(`/comments/${commentId}`, { content }, { token }).then(D);
export const deleteComment = (commentId: string, token: string) =>
  apiDelete<{ data: { deleted: boolean } }>(`/comments/${commentId}`, { token }).then(D);

// ==== Kiểm duyệt ====
export const reportTarget = (kind: 'posts' | 'comments', id: string, body: { reason: ReportReason; detail?: string }, token: string) =>
  apiPost<{ data: Report }>(`/${kind}/${id}/report`, body, { token }).then(D);
export const fetchReports = (courseId: string, query: { status?: ReportStatus; page?: number }, token: string, signal?: AbortSignal) =>
  apiGet<Paginated<Report>>(`/courses/${courseId}/reports`, query, signal, { token });
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
export const downloadCommunityIcs = (courseId: string, token: string) => apiDownload(`/courses/${courseId}/events.ics`, `lich-cong-dong-${courseId}.ics`, { token });

// ==== Lớp học mở rộng ====
export const fetchLesson = (courseId: string, lessonId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: LessonDetail }>(`/courses/${courseId}/lessons/${lessonId}`, undefined, signal, { token }).then(D);
export const fetchProgress = (courseId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: CourseProgress }>(`/courses/${courseId}/progress`, undefined, signal, { token }).then(D);
export const fetchCertificate = (courseId: string, token: string) =>
  apiGet<{ data: Certificate }>(`/courses/${courseId}/certificate`, undefined, undefined, { token }).then(D);
export const verifyCertificate = (code: string, signal?: AbortSignal) =>
  apiGet<{ data: CertificateVerification }>(`/certificates/${encodeURIComponent(code)}`, undefined, signal).then(D);
export const fetchClassroomSettings = (courseId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: { certificatesEnabled: boolean } }>(`/courses/${courseId}/classroom-settings`, undefined, signal, { token }).then(D);
export const updateClassroomSettings = (courseId: string, body: { certificatesEnabled: boolean }, token: string) =>
  apiPatch<{ data: { certificatesEnabled: boolean } }>(`/courses/${courseId}/classroom-settings`, body, { token }).then(D);
export const createModule = (courseId: string, body: ModuleInput, token: string) =>
  apiPost<{ data: ClassroomModule }>(`/courses/${courseId}/modules`, body, { token }).then(D);
export const updateModule = (courseId: string, moduleId: string, body: Partial<ModuleInput>, token: string) =>
  apiPatch<{ data: ClassroomModule }>(`/courses/${courseId}/modules/${moduleId}`, body, { token }).then(D);
export const deleteModule = (courseId: string, moduleId: string, token: string) =>
  apiDelete<{ data: { deleted: boolean } }>(`/courses/${courseId}/modules/${moduleId}`, { token }).then(D);
export const reorderModules = (courseId: string, ids: string[], token: string) =>
  apiPut<{ data: ClassroomModule[] }>(`/courses/${courseId}/modules/order`, { ids }, { token }).then(D);
export const createLesson = (courseId: string, moduleId: string, body: LessonInput, token: string) =>
  apiPost<{ data: ClassroomLesson }>(`/courses/${courseId}/modules/${moduleId}/lessons`, body, { token }).then(D);
export const updateLesson = (courseId: string, lessonId: string, body: Partial<LessonInput>, token: string) =>
  apiPatch<{ data: ClassroomLesson }>(`/courses/${courseId}/lessons/${lessonId}`, body, { token }).then(D);
export const deleteLesson = (courseId: string, lessonId: string, token: string) =>
  apiDelete<{ data: { deleted: boolean } }>(`/courses/${courseId}/lessons/${lessonId}`, { token }).then(D);
export const reorderLessons = (courseId: string, moduleId: string, ids: string[], token: string) =>
  apiPut<{ data: ClassroomLesson[] }>(`/courses/${courseId}/modules/${moduleId}/lessons/order`, { ids }, { token }).then(D);
