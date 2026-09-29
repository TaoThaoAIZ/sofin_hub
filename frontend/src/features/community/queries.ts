import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import * as api from './api';
import type {
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

const keys = {
  posts: (courseId: string, query: object) => ['community', courseId, 'posts', query] as const,
  comments: (postId: string) => ['community', 'comments', postId] as const,
  modules: (courseId: string) => ['community', courseId, 'modules'] as const,
  lessons: (courseId: string, moduleId: string) => ['community', courseId, 'modules', moduleId, 'lessons'] as const,
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
  if (!accessToken) throw new Error('Bạn cần đăng nhập');
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

// ---- Lớp học ----
export const useModules = (courseId: string) => {
  const { accessToken, status } = useAuth();
  return useQuery({
    queryKey: keys.modules(courseId),
    queryFn: ({ signal }) => api.fetchModules(courseId, accessToken!, signal),
    enabled: status === 'authenticated',
  });
};

export const useLessons = (courseId: string, moduleId: string | null) => {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: keys.lessons(courseId, moduleId ?? ''),
    queryFn: ({ signal }) => api.fetchLessons(courseId, moduleId!, accessToken!, signal),
    enabled: !!moduleId && !!accessToken,
  });
};

export const useToggleLessonComplete = (courseId: string, moduleId: string | null) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: string) => api.toggleLessonComplete(courseId, lessonId, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.modules(courseId) });
      if (moduleId) qc.invalidateQueries({ queryKey: keys.lessons(courseId, moduleId) });
      qc.invalidateQueries({ queryKey: ['community', courseId, 'progress'] });
      qc.invalidateQueries({ queryKey: ['community', courseId, 'lesson'] });
      qc.invalidateQueries({ queryKey: ['community', courseId, 'leaderboard'] });
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

// ---- Lớp học mở rộng ----
export const useLesson = (courseId: string, lessonId: string) => {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ['community', courseId, 'lesson', lessonId] as const,
    queryFn: ({ signal }) => api.fetchLesson(courseId, lessonId, accessToken!, signal),
    enabled: !!accessToken && !!lessonId,
    retry: false,
  });
};

export const useProgress = (courseId: string) => {
  const { accessToken, status } = useAuth();
  return useQuery({
    queryKey: ['community', courseId, 'progress'] as const,
    queryFn: ({ signal }) => api.fetchProgress(courseId, accessToken!, signal),
    enabled: status === 'authenticated',
  });
};

export const useClassroomSettings = (courseId: string) => {
  const { accessToken, status } = useAuth();
  return useQuery({
    queryKey: ['community', courseId, 'classroom-settings'] as const,
    queryFn: ({ signal }) => api.fetchClassroomSettings(courseId, accessToken!, signal),
    enabled: status === 'authenticated',
  });
};

export const useUpdateClassroomSettings = (courseId: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (certificatesEnabled: boolean) => api.updateClassroomSettings(courseId, { certificatesEnabled }, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community', courseId, 'classroom-settings'] }),
  });
};

export const useClaimCertificate = (courseId: string) => {
  const token = useToken();
  return useMutation({ mutationFn: () => api.fetchCertificate(courseId, token) });
};

/** Mọi thay đổi nội dung lớp học: làm mới danh sách module/bài, chi tiết bài và tiến độ. */
function useClassroomMutation<V, R>(courseId: string, fn: (vars: V, token: string) => Promise<R>) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: V) => fn(vars, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community', courseId] }),
  });
}

export const useCreateModule = (courseId: string) =>
  useClassroomMutation(courseId, (v: ModuleInput, t) => api.createModule(courseId, v, t));
export const useUpdateModule = (courseId: string) =>
  useClassroomMutation(courseId, (v: { moduleId: string; body: Partial<ModuleInput> }, t) => api.updateModule(courseId, v.moduleId, v.body, t));
export const useDeleteModule = (courseId: string) =>
  useClassroomMutation(courseId, (moduleId: string, t) => api.deleteModule(courseId, moduleId, t));
export const useReorderModules = (courseId: string) =>
  useClassroomMutation(courseId, (ids: string[], t) => api.reorderModules(courseId, ids, t));
export const useCreateLesson = (courseId: string) =>
  useClassroomMutation(courseId, (v: { moduleId: string; body: LessonInput }, t) => api.createLesson(courseId, v.moduleId, v.body, t));
export const useUpdateLesson = (courseId: string) =>
  useClassroomMutation(courseId, (v: { lessonId: string; body: Partial<LessonInput> }, t) => api.updateLesson(courseId, v.lessonId, v.body, t));
export const useDeleteLesson = (courseId: string) =>
  useClassroomMutation(courseId, (lessonId: string, t) => api.deleteLesson(courseId, lessonId, t));
export const useReorderLessons = (courseId: string) =>
  useClassroomMutation(courseId, (v: { moduleId: string; ids: string[] }, t) => api.reorderLessons(courseId, v.moduleId, v.ids, t));

/** Xác minh chứng nhận công khai — không cần đăng nhập. */
export const useVerifyCertificate = (code: string) =>
  useQuery({
    queryKey: ['certificate', code] as const,
    queryFn: ({ signal }) => api.verifyCertificate(code, signal),
    enabled: !!code,
    retry: false,
  });
