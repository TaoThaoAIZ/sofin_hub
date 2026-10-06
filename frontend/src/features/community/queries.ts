import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import * as api from './api';
import type {
  CourseInput,
  CreatePostInput,
  LeaderboardWindow,
  LessonInput,
  MemberFilter,
  ModuleInput,
  Post,
  PostQuery,
  ReportAction,
  ReportReason,
  ReportStatus,
  UpdateEventInput,
  UpdatePostInput,
} from './types';
import i18n from '../../i18n';

const keys = {
  posts: (courseId: string, query: object) => ['community', courseId, 'posts', query] as const,
  comments: (postId: string) => ['community', 'comments', postId] as const,
  events: (courseId: string) => ['community', courseId, 'events'] as const,
  members: (courseId: string, query: object) => ['community', courseId, 'members', query] as const,
  leaderboard: (courseId: string, window: LeaderboardWindow) => ['community', courseId, 'leaderboard', window] as const,
};

/** Cập nhật 1 bài trong mọi cache danh sách (phân trang thường + tải thêm) và cache bài lẻ. */
export function patchPostCaches(qc: QueryClient, courseId: string, postId: string, fn: (p: Post) => Post) {
  qc.setQueriesData<unknown>({ queryKey: ["community", courseId, "posts"] }, (prev: unknown) => {
    if (!prev || typeof prev !== 'object') return prev;
    const v = prev as { data?: Post[]; pages?: { data: Post[] }[] };
    if (Array.isArray(v.data)) return { ...v, data: v.data.map((p) => (p.id === postId ? fn(p) : p)) };
    if (Array.isArray(v.pages)) return { ...v, pages: v.pages.map((pg) => ({ ...pg, data: pg.data.map((p) => (p.id === postId ? fn(p) : p)) })) };
    return prev;
  });
  qc.setQueryData<Post>(['community', 'post', postId], (prev: Post | undefined) => (prev ? fn(prev) : prev));
}

function useToken() {
  const { accessToken } = useAuth();
  if (!accessToken) throw new Error(i18n.t('ui.loginRequired', { ns: 'community' }));
  return accessToken;
}

// ---- Bảng tin ----
export const usePosts = (courseId: string, query: PostQuery) => {
  const { accessToken, status } = useAuth();
  return useQuery({
    queryKey: keys.posts(courseId, query),
    queryFn: ({ signal }) => api.fetchPosts(courseId, query, accessToken!, signal),
    enabled: status === 'authenticated',
  });
};

export const useCreatePost = (courseId: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: CreatePostInput) => api.createPost(courseId, vars, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community', courseId, 'posts'] }),
  });
};

export const useToggleLike = (courseId: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => api.toggleLike(postId, token),
    onSuccess: ({ liked, likesCount }, postId) => patchPostCaches(qc, courseId, postId, (p) => ({ ...p, viewerLiked: liked, likesCount })),
  });
};

export const useTogglePin = (courseId: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => api.togglePin(postId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community', courseId, 'posts'] }),
  });
};

export const useComments = (postId: string, enabled: boolean) => {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: keys.comments(postId),
    queryFn: ({ signal }) => api.fetchComments(postId, accessToken!, signal),
    enabled: enabled && !!accessToken,
  });
};

export const useCreateComment = (courseId: string, postId: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.createComment(postId, content, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.comments(postId) });
      qc.invalidateQueries({ queryKey: ['community', courseId, 'posts'] });
    },
  });
};

// ---- Lịch sự kiện ----
export const useEvents = (courseId: string) => {
  const { accessToken, status } = useAuth();
  return useQuery({
    queryKey: keys.events(courseId),
    queryFn: ({ signal }) => api.fetchEvents(courseId, accessToken!, signal),
    enabled: status === 'authenticated',
  });
};

export const useCreateEvent = (courseId: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { title: string; description: string; startAt: string; timezone: string; meetingLink?: string; capacity?: number }) =>
      api.createEvent(courseId, vars, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.events(courseId) }),
  });
};

export const useToggleRsvp = (courseId: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.toggleRsvp(eventId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.events(courseId) }),
  });
};

// ---- Thành viên ----
export const useMembers = (courseId: string, query: { q?: string; page?: number; filter?: MemberFilter; sort?: 'active' | 'joined' }) => {
  const { accessToken, status } = useAuth();
  return useQuery({
    placeholderData: keepPreviousData,
    queryKey: keys.members(courseId, query),
    queryFn: ({ signal }) => api.fetchMembers(courseId, query, accessToken!, signal),
    enabled: status === 'authenticated',
  });
};

// ---- Bảng xếp hạng ----
export const useLeaderboard = (courseId: string, window: LeaderboardWindow) => {
  const { accessToken, status } = useAuth();
  return useQuery({
    queryKey: keys.leaderboard(courseId, window),
    queryFn: ({ signal }) => api.fetchLeaderboard(courseId, window, accessToken!, signal),
    enabled: status === 'authenticated',
  });
};

export const useLevels = (courseId: string) => {
  const { accessToken, status } = useAuth();
  return useQuery({
    queryKey: ['community', courseId, 'levels'] as const,
    queryFn: ({ signal }) => api.fetchLevels(courseId, accessToken!, signal),
    enabled: status === 'authenticated',
  });
};

// ==== Nhóm nội dung mở rộng ====
/** Bảng tin phân trang kiểu "Tải thêm" (chung tiền tố khóa với usePosts để mọi mutation cũ vẫn làm mới được). */
export const usePostsFeed = (courseId: string, query: Omit<PostQuery, 'page'>) => {
  const { accessToken, status } = useAuth();
  return useInfiniteQuery({
    queryKey: ['community', courseId, 'posts', 'feed', query] as const,
    queryFn: ({ pageParam, signal }) => api.fetchPosts(courseId, { ...query, page: pageParam }, accessToken!, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    enabled: status === 'authenticated',
  });
};

export const usePost = (postId: string | null) => {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['community', 'post', postId ?? ''] as const,
    queryFn: ({ signal }) => api.fetchPost(postId!, accessToken!, signal),
    enabled: !!postId && !!accessToken,
    retry: false,
  });
};

export const useTags = (courseId: string) => {
  const { accessToken, status } = useAuth();
  return useQuery({
    queryKey: ['community', courseId, 'tags'] as const,
    queryFn: ({ signal }) => api.fetchTags(courseId, accessToken!, signal),
    enabled: status === 'authenticated',
  });
};

export const useUpdatePost = (courseId: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { postId: string; body: UpdatePostInput }) => api.updatePost(vars.postId, vars.body, token),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['community', courseId, 'posts'] });
      qc.invalidateQueries({ queryKey: ['community', courseId, 'tags'] });
      qc.invalidateQueries({ queryKey: ['community', 'post', v.postId] });
    },
  });
};

export const useDeletePost = (courseId: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => api.deletePost(postId, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community', courseId, 'posts'] });
      qc.invalidateQueries({ queryKey: ['community', courseId, 'tags'] });
    },
  });
};

export const useSetPostHidden = (courseId: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { postId: string; hidden: boolean }) => api.setPostHidden(vars.postId, vars.hidden, token),
    onSuccess: (_d, v) => patchPostCaches(qc, courseId, v.postId, (p) => ({ ...p, hidden: v.hidden })),
  });
};

export const useVotePoll = (courseId: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { postId: string; optionIds: string[] }) => api.votePoll(vars.postId, vars.optionIds, token),
    onSuccess: (post) => patchPostCaches(qc, courseId, post.id, (p) => ({ ...p, poll: post.poll })),
  });
};

export const useUpdateComment = (postId: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { commentId: string; content: string }) => api.updateComment(vars.commentId, vars.content, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.comments(postId) }),
  });
};

export const useDeleteComment = (courseId: string, postId: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api.deleteComment(commentId, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.comments(postId) });
      qc.invalidateQueries({ queryKey: ['community', courseId, 'posts'] });
    },
  });
};

export const useReportContent = () => {
  const token = useToken();
  return useMutation({
    mutationFn: (vars: { kind: 'posts' | 'comments'; id: string; reason: ReportReason; detail?: string }) =>
      api.reportTarget(vars.kind, vars.id, { reason: vars.reason, detail: vars.detail || undefined }, token),
  });
};

// ---- Kiểm duyệt ----
/** `courseId = null` => báo cáo toàn nền tảng (Platform Admin). */
export const useReports = (courseId: string | null, status: ReportStatus | undefined, page: number) => {
  const { accessToken, status: auth } = useAuth();
  return useQuery({
    placeholderData: keepPreviousData,
    queryKey: courseId ? (['community', courseId, 'reports', { status, page }] as const) : (['admin', 'reports', { status, page }] as const),
    queryFn: ({ signal }) =>
      courseId ? api.fetchReports(courseId, { status, page }, accessToken!, signal) : api.fetchAdminReports({ status, page }, accessToken!, signal),
    enabled: auth === 'authenticated',
  });
};

export const useResolveReport = (courseId: string | null) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { reportId: string; action: ReportAction; note?: string }) =>
      api.resolveReport(vars.reportId, { action: vars.action, note: vars.note || undefined }, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseId ? ['community', courseId, 'reports'] : ['admin', 'reports'] });
      if (courseId) qc.invalidateQueries({ queryKey: ['community', courseId, 'posts'] });
    },
  });
};

// ---- Sự kiện mở rộng ----
export const useUpdateEvent = (courseId: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { eventId: string; body: UpdateEventInput }) => api.updateEvent(vars.eventId, vars.body, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.events(courseId) }),
  });
};

export const useDeleteEvent = (courseId: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.deleteEvent(eventId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.events(courseId) }),
  });
};

export const useCancelRsvp = (courseId: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.cancelRsvp(eventId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.events(courseId) }),
  });
};

export const useDownloadIcs = () => {
  const token = useToken();
  return useMutation({
    mutationFn: (vars: { eventId?: string; courseId?: string }) =>
      vars.eventId ? api.downloadEventIcs(vars.eventId, token) : api.downloadCommunityIcs(vars.courseId!, token),
  });
};

/** Xác minh chứng nhận công khai — không cần đăng nhập. */
export const useVerifyCertificate = (code: string) =>
  useQuery({
    queryKey: ['certificate', code] as const,
    queryFn: ({ signal }) => api.verifyCertificate(code, signal),
    enabled: !!code,
    retry: false,
  });

// ---- Lớp học: khóa học trong cộng đồng ----
// cid = id cộng đồng; courseId = id khóa học (uuid). Mọi key nằm dưới ['community', cid] nên đổi cộng đồng là tách cache.
const ck = {
  courses: (cid: string) => ['community', cid, 'courses'] as const,
  modules: (cid: string, courseId: string) => ['community', cid, 'classroom', courseId, 'modules'] as const,
  lessons: (cid: string, courseId: string, moduleId: string) => ['community', cid, 'classroom', courseId, 'modules', moduleId, 'lessons'] as const,
  progress: (cid: string, courseId: string) => ['community', cid, 'classroom', courseId, 'progress'] as const,
};

export const useCourseList = (cid: string) => {
  const { accessToken, status } = useAuth();
  return useQuery({
    queryKey: ck.courses(cid),
    queryFn: ({ signal }) => api.fetchCourseList(cid, accessToken!, signal),
    enabled: status === 'authenticated',
  });
};

export const useModules = (cid: string, courseId: string | null) => {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ck.modules(cid, courseId ?? ''),
    queryFn: ({ signal }) => api.fetchModules(cid, courseId!, accessToken!, signal),
    enabled: !!courseId && !!accessToken,
  });
};

export const useLessons = (cid: string, courseId: string | null, moduleId: string | null) => {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ck.lessons(cid, courseId ?? '', moduleId ?? ''),
    queryFn: ({ signal }) => api.fetchLessons(cid, courseId!, moduleId!, accessToken!, signal),
    enabled: !!courseId && !!moduleId && !!accessToken,
  });
};

export const useLesson = (cid: string, lessonId: string) => {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['community', cid, 'lesson', lessonId] as const,
    queryFn: ({ signal }) => api.fetchLesson(cid, lessonId, accessToken!, signal),
    enabled: !!accessToken && !!lessonId,
    retry: false,
  });
};

export const useProgress = (cid: string, courseId: string | null) => {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ck.progress(cid, courseId ?? ''),
    queryFn: ({ signal }) => api.fetchProgress(cid, courseId!, accessToken!, signal),
    enabled: !!courseId && !!accessToken,
  });
};

export const useToggleLessonComplete = (cid: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: string) => api.toggleLessonComplete(cid, lessonId, token),
    onSuccess: () => {
      // Tiến độ nằm theo khóa: làm mới toàn bộ nhánh lớp học + danh sách khóa (progress từng khóa) + bảng xếp hạng.
      qc.invalidateQueries({ queryKey: ['community', cid, 'classroom'] });
      qc.invalidateQueries({ queryKey: ck.courses(cid) });
      qc.invalidateQueries({ queryKey: ['community', cid, 'lesson'] });
      qc.invalidateQueries({ queryKey: ['community', cid, 'leaderboard'] });
    },
  });
};

export const useClassroomSettings = (cid: string) => {
  const { accessToken, status } = useAuth();
  return useQuery({
    queryKey: ['community', cid, 'classroom-settings'] as const,
    queryFn: ({ signal }) => api.fetchClassroomSettings(cid, accessToken!, signal),
    enabled: status === 'authenticated',
  });
};

export const useUpdateClassroomSettings = (cid: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (certificatesEnabled: boolean) => api.updateClassroomSettings(cid, { certificatesEnabled }, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community', cid, 'classroom-settings'] });
      qc.invalidateQueries({ queryKey: ck.courses(cid) });
    },
  });
};

export const useClaimCertificate = (cid: string, courseId: string) => {
  const token = useToken();
  return useMutation({ mutationFn: () => api.fetchCertificate(cid, courseId, token) });
};

/** Mọi thay đổi nội dung/khóa học: làm mới toàn bộ cache của cộng đồng (khóa, module, bài, tiến độ). */
function useClassroomMutation<V, R>(cid: string, fn: (vars: V, token: string) => Promise<R>) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: V) => fn(vars, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community', cid] }),
  });
}

export const useCreateCourse = (cid: string) => useClassroomMutation(cid, (v: CourseInput, t) => api.createCourse(cid, v, t));
export const useUpdateCourse = (cid: string) =>
  useClassroomMutation(cid, (v: { courseId: string; body: Partial<CourseInput> & { certificatesEnabled?: boolean | null } }, t) => api.updateCourse(cid, v.courseId, v.body, t));
export const useArchiveCourse = (cid: string) => useClassroomMutation(cid, (courseId: string, t) => api.archiveCourse(cid, courseId, t));
export const useDeleteCourse = (cid: string) => useClassroomMutation(cid, (courseId: string, t) => api.deleteCourse(cid, courseId, t));
export const useReorderCourses = (cid: string) => useClassroomMutation(cid, (ids: string[], t) => api.reorderCourses(cid, ids, t));

export const useCreateModule = (cid: string, courseId: string) =>
  useClassroomMutation(cid, (v: ModuleInput, t) => api.createModule(cid, courseId, v, t));
export const useUpdateModule = (cid: string, courseId: string) =>
  useClassroomMutation(cid, (v: { moduleId: string; body: Partial<ModuleInput> }, t) => api.updateModule(cid, courseId, v.moduleId, v.body, t));
export const useDeleteModule = (cid: string, courseId: string) =>
  useClassroomMutation(cid, (moduleId: string, t) => api.deleteModule(cid, courseId, moduleId, t));
export const useReorderModules = (cid: string, courseId: string) =>
  useClassroomMutation(cid, (ids: string[], t) => api.reorderModules(cid, courseId, ids, t));
export const useCreateLesson = (cid: string, courseId: string) =>
  useClassroomMutation(cid, (v: { moduleId: string; body: LessonInput }, t) => api.createLesson(cid, courseId, v.moduleId, v.body, t));
export const useUpdateLesson = (cid: string) =>
  useClassroomMutation(cid, (v: { lessonId: string; body: Partial<LessonInput> }, t) => api.updateLesson(cid, v.lessonId, v.body, t));
export const useDeleteLesson = (cid: string) =>
  useClassroomMutation(cid, (lessonId: string, t) => api.deleteLesson(cid, lessonId, t));
export const useReorderLessons = (cid: string, courseId: string) =>
  useClassroomMutation(cid, (v: { moduleId: string; ids: string[] }, t) => api.reorderLessons(cid, courseId, v.moduleId, v.ids, t));

export const useModuleAccess = (cid: string, courseId: string | null, moduleId: string | null) => {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: [...ck.modules(cid, courseId ?? ''), moduleId ?? '', 'access'] as const,
    queryFn: ({ signal }) => api.fetchModuleAccess(cid, courseId!, moduleId!, accessToken!, signal),
    enabled: !!courseId && !!moduleId && !!accessToken,
  });
};
export const useSetModuleAccess = (cid: string, courseId: string) =>
  useClassroomMutation(cid, (v: { moduleId: string; userIds: string[] }, t) => api.setModuleAccess(cid, courseId, v.moduleId, v.userIds, t));
