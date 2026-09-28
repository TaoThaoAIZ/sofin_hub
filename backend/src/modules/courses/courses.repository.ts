import { courses, trendingRank } from './courses.seed.js';
import type { Course } from './course.types.js';
import type { ListCoursesQuery } from './courses.schema.js';

/**
 * Lớp truy cập dữ liệu. Hiện đọc từ seed trong bộ nhớ; khi có DB (RDS/DynamoDB)
 * chỉ cần thay implementation này, service/controller giữ nguyên.
 */
export interface CourseRepository {
  findMany(query: ListCoursesQuery): Promise<{ items: Course[]; total: number }>;
  findById(id: string): Promise<Course | undefined>;
  countByCategory(): Promise<Record<string, number>>;
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .toLowerCase();

const sorters: Record<ListCoursesQuery['sort'], (a: Course, b: Course) => number> = {
  trending: (a, b) => (trendingRank.get(a.id) ?? 0) - (trendingRank.get(b.id) ?? 0),
  top: (a, b) => b.rating * Math.log1p(b.ratingCount) - a.rating * Math.log1p(a.ratingCount),
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
};

export const inMemoryCourseRepository: CourseRepository = {
  async findMany({ q, category, pricing, visibility, status, language, sort, page, limit }) {
    const needle = q ? normalize(q) : '';
    const filtered = courses.filter(
      (c) =>
        (!category || c.category === category) &&
        (!pricing || c.pricing === pricing) &&
        (!visibility || c.visibility === visibility) &&
        (!status || c.status === status) &&
        (!language || c.language === language) &&
        (!needle || normalize(`${c.title} ${c.description} ${c.instructor.name}`).includes(needle)),
    );
    filtered.sort(sorters[sort]);
    const start = (page - 1) * limit;
    return { items: filtered.slice(start, start + limit), total: filtered.length };
  },

  async findById(id) {
    return courses.find((c) => c.id === id);
  },

  async countByCategory() {
    const counts: Record<string, number> = {};
    for (const c of courses) counts[c.category] = (counts[c.category] ?? 0) + 1;
    return counts;
  },
};
