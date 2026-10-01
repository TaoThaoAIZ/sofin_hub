import { HttpError } from '../../utils/http-error.js';
import { cfg } from '../settings/settings.service.js';
import { buildCommunityDetail, type CommunityDetail, type CourseReview } from './community-detail.js';
import type { Community, CommunityPatch } from './community.types.js';
import { catalogRepository, type CatalogRepository } from './catalog.repository.js';
import type { ListCommunitiesQuery } from './catalog.schema.js';

export function createCatalogService(repo: CatalogRepository = catalogRepository) {
  return {
    async list(query: ListCommunitiesQuery, opts?: { forSearch?: boolean }) {
      const { items, total } = await repo.findMany(query, opts);
      return {
        data: items,
        meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
      };
    },

    async getById(id: string): Promise<Community> {
      const course = await repo.findById(id);
      if (!course) throw HttpError.notFound('Không tìm thấy khóa học');
      return course;
    },

    briefsByIds: (ids: string[]) => repo.findBriefs(ids),

    /** Như getById nhưng chỉ trả cờ `locked` (1 truy vấn nhẹ) — cho các guard chạy trên mọi request. 404 nếu không có. */
    async requireLockState(id: string): Promise<{ locked: boolean }> {
      const state = await repo.lockState(id);
      if (!state) throw HttpError.notFound('Không tìm thấy khóa học');
      return state;
    },

    async getDetailById(id: string, viewerEnrolled?: boolean, realReviews: CourseReview[] = []): Promise<CommunityDetail> {
      const course = await this.getById(id);
      // Mọi số liệu lấy từ DB thật (Enrollment, ClassroomLesson, Global Settings); không sinh nội dung minh họa.
      const [{ online, admins }, lessons, courses] = await Promise.all([repo.memberStats(id), repo.lessonCount(id), repo.courseInfo(id)]);
      return buildCommunityDetail(course, viewerEnrolled, realReviews, { online, admins, lessons, trialDays: cfg().payments.trialDays, ...courses });
    },

    create: (course: Community) => repo.create(course),
    createWithOwner: (community: Omit<Community, 'id'>, baseSlug: string, ownerId: string) => repo.createWithOwner(community, baseSlug, ownerId),
    idExists: (id: string) => repo.idExists(id),

    async update(id: string, patch: CommunityPatch): Promise<Community> {
      const updated = await repo.update(id, patch);
      if (!updated) throw HttpError.notFound('Không tìm thấy khóa học');
      return updated;
    },

    /** Lý do bị khóa (Community.lockReason) — undefined nếu cộng đồng không bị khóa. */
    getLockReason: (id: string) => repo.getLockReason(id),

    /**
     * Giữ chữ ký cũ cho enrollmentService: `students` giờ được TÍNH khi đọc (số nền của seed + thành viên thật
     * từ bảng Enrollment) nên không cần đồng bộ nữa.
     */
    async syncStudents(_id: string, _memberCount: number): Promise<void> {},
  };
}

export const catalogService = createCatalogService();
