import { communityService } from '../community/community.service.js';
import type { Course } from '../courses/course.types.js';
import { courseService } from '../courses/courses.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { atLeast, getRole } from '../permissions/policy.js';
import { postsService } from '../posts/posts.service.js';
import type { SearchQuery } from './search.schema.js';
import { makeSnippet, matches, normalizeText, type Segment } from './search.text.js';

export type SearchResult =
  | { type: 'course'; id: string; title: Segment[]; snippet: Segment[]; link: string }
  | { type: 'member'; id: string; courseId: string; courseTitle: string; name: Segment[]; handle: string; role: 'admin' | 'member'; link: string }
  | { type: 'post'; id: string; courseId: string; courseTitle: string; author: string; snippet: Segment[]; createdAt: string; link: string };

/** Giới hạn quét trong bộ nhớ: tránh 1 truy vấn duyệt vô hạn (nâng cấp: Postgres full-text / pg_trgm). */
const MAX_PAGES_PER_COURSE = 20;
const PAGE = 50;

/** Cờ "khóa/xóa" có thể do module khác thêm vào Course sau này; đọc lỏng để không phụ thuộc kiểu. */
const isSearchable = (c: Course) => {
  const x = c as Course & { locked?: boolean; deletedAt?: string | null; status?: string };
  return !x.locked && !x.deletedAt;
};

async function publicCourses(): Promise<Course[]> {
  const out: Course[] = [];
  for (let page = 1; page <= MAX_PAGES_PER_COURSE; page++) {
    const r = await courseService.list({ visibility: 'public', sort: 'newest', page, limit: PAGE });
    out.push(...r.data);
    if (page >= r.meta.totalPages) break;
  }
  return out.filter(isSearchable);
}

export function createSearchService() {
  async function searchCourses(needle: string, courseId?: string): Promise<SearchResult[]> {
    return (await publicCourses())
      .filter((c) => (!courseId || c.id === courseId) && (matches(c.title, needle) || matches(c.description, needle)))
      .map((c) => ({
        type: 'course' as const,
        id: c.id,
        title: makeSnippet(c.title, needle, 100),
        snippet: makeSnippet(c.description, needle),
        link: `/courses/${c.id}`,
      }));
  }

  /** Cộng đồng user là thành viên (hoặc đúng courseId nếu chỉ định — 404/403 nếu không hợp lệ). */
  async function scopeCourses(userId: string, courseId?: string): Promise<Course[]> {
    if (courseId) {
      const course = await courseService.getById(courseId);
      await enrollmentService.requireMembership(userId, courseId);
      return [course];
    }
    const memberships = await enrollmentService.listByUser(userId);
    const courses = await Promise.all(memberships.map((m) => courseService.getById(m.courseId).catch(() => undefined)));
    return courses.filter((c): c is Course => !!c && isSearchable(c));
  }

  async function searchMembers(courses: Course[], needle: string): Promise<SearchResult[]> {
    const out: SearchResult[] = [];
    for (const course of courses) {
      for (let page = 1; page <= MAX_PAGES_PER_COURSE; page++) {
        const r = await communityService.listMembers(course.id, { filter: 'all', sort: 'active', page, limit: PAGE });
        for (const m of r.data) {
          if (!matches(m.name, needle) && !normalizeText(m.handle).includes(needle)) continue;
          out.push({
            type: 'member',
            id: m.id,
            courseId: course.id,
            courseTitle: course.title,
            name: makeSnippet(m.name, needle, 100),
            handle: m.handle,
            role: m.role,
            link: `/courses/${course.id}/community?tab=members`,
          });
        }
        if (page >= r.meta.totalPages) break;
      }
    }
    return out;
  }

  async function searchPosts(userId: string, courses: Course[], needle: string): Promise<SearchResult[]> {
    const out: SearchResult[] = [];
    for (const course of courses) {
      const canSeeHidden = atLeast(await getRole(userId, course.id), 'mod');
      for (let page = 1; page <= MAX_PAGES_PER_COURSE; page++) {
        const r = await postsService.list(course.id, { sort: 'latest', page, limit: PAGE }, userId);
        for (const p of r.data) {
          if ((p as { hidden?: boolean }).hidden && !canSeeHidden) continue; // bài bị ẩn chỉ mod+ thấy
          const haystack = `${p.content} ${p.tags.join(' ')} ${p.author.name}`;
          if (!matches(haystack, needle)) continue;
          out.push({
            type: 'post',
            id: p.id,
            courseId: course.id,
            courseTitle: course.title,
            author: p.author.name,
            snippet: makeSnippet(matches(p.content, needle) ? p.content : `${p.tags.join(' ')} ${p.content}`, needle),
            createdAt: p.createdAt,
            link: `/courses/${course.id}/community?post=${p.id}`,
          });
        }
        if (page >= r.meta.totalPages) break;
      }
    }
    return out.sort((a, b) => (a.type === 'post' && b.type === 'post' ? b.createdAt.localeCompare(a.createdAt) : 0));
  }

  /** Gom kết quả theo loại (chưa phân trang). */
  async function collect(userId: string, q: string, type: SearchQuery['type'], courseId?: string) {
    const needle = normalizeText(q);
    const wantCourses = type === 'all' || type === 'courses';
    const wantScoped = type === 'all' || type === 'posts' || type === 'members';
    // Khóa học là công khai nên type=courses không cần là thành viên; posts/members thì bắt buộc.
    const scoped = wantScoped ? await scopeCourses(userId, courseId) : [];
    return {
      courses: wantCourses ? await searchCourses(needle, courseId) : [],
      members: type === 'all' || type === 'members' ? await searchMembers(scoped, needle) : [],
      posts: type === 'all' || type === 'posts' ? await searchPosts(userId, scoped, needle) : [],
    };
  }

  return {
    async search(userId: string, query: SearchQuery) {
      const g = await collect(userId, query.q, query.type, query.courseId);
      const merged: SearchResult[] = [...g.courses, ...g.members, ...g.posts];
      const total = merged.length;
      const start = (query.page - 1) * query.limit;
      return {
        data: merged.slice(start, start + query.limit),
        meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
        counts: { courses: g.courses.length, members: g.members.length, posts: g.posts.length },
      };
    },

    /** Gợi ý topbar: tối đa 5 mục, xen kẽ khóa học / thành viên / bài viết. */
    async suggest(userId: string, q: string) {
      const g = await collect(userId, q, 'all');
      const lists = [g.courses, g.members, g.posts];
      const out: SearchResult[] = [];
      for (let i = 0; out.length < 5 && lists.some((l) => i < l.length); i++) {
        for (const l of lists) if (i < l.length && out.length < 5) out.push(l[i]!);
      }
      return out;
    },
  };
}

export const searchService = createSearchService();
