import { handleFor } from '../community/community.handle.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { isPlatformAdmin } from '../permissions/policy.js';
import { buildTerms, searchRepository as defaultRepo, trgmSchema, type PageSpec, type SearchTerms } from './search.repository.js';
import type { SearchQuery } from './search.schema.js';
import { highlightNeedle, makeSnippetFor, type Segment } from './search.text.js';

export type SearchResult =
  | { type: 'course'; id: string; title: Segment[]; snippet: Segment[]; link: string }
  | { type: 'member'; id: string; courseId: string; communityId: string; courseTitle: string; name: Segment[]; handle: string; role: 'admin' | 'member'; link: string }
  | { type: 'post'; id: string; courseId: string; communityId: string; courseTitle: string; author: string; snippet: Segment[]; createdAt: string; link: string };

type Repo = typeof defaultRepo;
type Group = 'courses' | 'members' | 'posts';

/**
 * Tìm kiếm toàn cục (STEP 8 audit): mọi lọc/xếp hạng/phân trang chạy trong Postgres (xem search.repository.ts); service chỉ
 * dựng phạm vi (cộng đồng của user), cắt trang qua 3 nhóm courses → members → posts và sinh Segment[] cho đúng các dòng của trang.
 */
export function createSearchService(repo: Repo = defaultRepo) {
  const termsOf = async (q: string) => buildTerms(q, (await trgmSchema()) !== null);

  /** Cộng đồng user là thành viên (hoặc đúng communityId nếu chỉ định — 404/403 nếu không hợp lệ). */
  async function scopeIds(userId: string, communityId?: string): Promise<string[]> {
    if (communityId) {
      await enrollmentService.requireMembership(userId, communityId); // 404 nếu không có khóa, 403 nếu chưa tham gia
      return [communityId];
    }
    return repo.scopeCourseIds(userId);
  }

  const toCourse = (c: { id: string; title: string; description: string }, t: SearchTerms): SearchResult => ({
    type: 'course',
    id: c.id,
    title: makeSnippetFor(c.title, t.needle, t.tokens, 100),
    snippet: makeSnippetFor(c.description, t.needle, t.tokens),
    link: `/courses/${c.id}`,
  });

  const toMember = (m: Awaited<ReturnType<Repo['pageMembers']>>[number], t: SearchTerms): SearchResult => {
    const name = `${m.firstName} ${m.lastName}`;
    return {
      type: 'member',
      id: m.id,
      courseId: m.courseId,
      communityId: m.courseId,
      courseTitle: m.courseTitle,
      name: makeSnippetFor(name, t.needle, t.tokens, 100),
      handle: handleFor(name, m.id),
      role: m.role === 'member' ? 'member' : 'admin',
      link: `/courses/${m.courseId}/community?tab=members`,
    };
  };

  const toPost = (p: Awaited<ReturnType<Repo['pagePosts']>>[number], t: SearchTerms): SearchResult => ({
    type: 'post',
    id: p.id,
    courseId: p.courseId,
    communityId: p.courseId,
    courseTitle: p.courseTitle,
    author: p.authorName,
    snippet: makeSnippetFor(highlightNeedle(p.content, t.needle, t.tokens) ? p.content : `${p.tags.join(' ')} ${p.content}`, t.needle, t.tokens),
    createdAt: p.createdAt.toISOString(),
    link: `/courses/${p.courseId}/community?post=${p.id}`,
  });

  const fetchGroup = {
    courses: async (t: SearchTerms, _ids: string[], _uid: string, _pa: boolean, page: PageSpec, communityId?: string) =>
      (await repo.pageCourses(t, page, communityId)).map((c) => toCourse(c, t)),
    members: async (t: SearchTerms, ids: string[], _uid: string, _pa: boolean, page: PageSpec) => (await repo.pageMembers(ids, t, page)).map((m) => toMember(m, t)),
    posts: async (t: SearchTerms, ids: string[], uid: string, pa: boolean, page: PageSpec) => (await repo.pagePosts(ids, t, uid, pa, page)).map((p) => toPost(p, t)),
  };

  return {
    async search(userId: string, query: SearchQuery) {
      const t = await termsOf(query.q);
      const want = (g: Group) => query.type === 'all' || query.type === g;
      // Khóa học là công khai nên type=courses không cần là thành viên; posts/members thì bắt buộc.
      const ids = want('members') || want('posts') ? await scopeIds(userId, query.communityId) : [];
      const pa = want('posts') && ids.length > 0 ? await isPlatformAdmin(userId) : false;

      const [nCourses, nMembers, nPosts] = await Promise.all([
        want('courses') ? repo.countCourses(t, query.communityId) : 0,
        want('members') ? repo.countMembers(ids, t) : 0,
        want('posts') ? repo.countPosts(ids, t, userId, pa) : 0,
      ]);
      const sizes: Record<Group, number> = { courses: nCourses, members: nMembers, posts: nPosts };
      const total = nCourses + nMembers + nPosts;

      // Cắt trang trên chuỗi nối [courses, members, posts]: mỗi nhóm chỉ truy vấn đúng đoạn LIMIT/OFFSET giao với trang.
      const start = (query.page - 1) * query.limit;
      const end = start + query.limit;
      let offset = 0;
      const jobs: Promise<SearchResult[]>[] = [];
      for (const g of ['courses', 'members', 'posts'] as const) {
        const lo = Math.max(start, offset) - offset;
        const hi = Math.min(end, offset + sizes[g]) - offset;
        offset += sizes[g];
        if (hi > lo) jobs.push(fetchGroup[g](t, ids, userId, pa, { offset: lo, limit: hi - lo }, query.communityId));
      }
      const data = (await Promise.all(jobs)).flat();
      return {
        data,
        meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
        counts: { courses: nCourses, members: nMembers, posts: nPosts },
      };
    },

    /** Gợi ý topbar: tối đa 5 mục, xen kẽ khóa học / thành viên / bài viết — mỗi nhóm một truy vấn LIMIT 5 riêng. */
    async suggest(userId: string, q: string) {
      const t = await termsOf(q);
      const ids = await scopeIds(userId);
      const pa = ids.length > 0 ? await isPlatformAdmin(userId) : false;
      const top: PageSpec = { offset: 0, limit: 5 };
      const lists = await Promise.all([
        fetchGroup.courses(t, ids, userId, pa, top),
        fetchGroup.members(t, ids, userId, pa, top),
        fetchGroup.posts(t, ids, userId, pa, top),
      ]);
      const out: SearchResult[] = [];
      for (let i = 0; out.length < 5 && lists.some((l) => i < l.length); i++) {
        for (const l of lists) if (i < l.length && out.length < 5) out.push(l[i]!);
      }
      return out;
    },
  };
}

export const searchService = createSearchService();
