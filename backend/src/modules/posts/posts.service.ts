import { randomUUID } from 'node:crypto';
import { HttpError } from '../../utils/http-error.js';
import { userBriefView } from '../auth/user-view.js';
import { courseService } from '../courses/courses.service.js';
import { notify } from '../notifications/notifications.service.js';
import { atLeast, canManageContent, getRole } from '../permissions/policy.js';
import { pointsService } from '../points/points.service.js';
import { userRepository } from '../auth/auth.repository.js';
import { postsRepository, type PostsRepository } from './posts.repository.js';
import type { Comment, CommentView, PollDef, PollView, Post, PostAuthorView, PostCategory, PostView } from './posts.types.js';
import type { CreatePollBody, ListPostsQuery, UpdatePostBody } from './posts.schema.js';

/** Đường dẫn FE để mở thẳng 1 bài viết. */
export const postPath = (post: Pick<Post, 'courseId' | 'id'>) => `/courses/${post.courseId}/community?post=${post.id}`;

/** Tên tác giả lấy từ User (thành viên minh họa cũng là User thật; tài khoản đã xóa hiện "Thành viên đã xóa"). */
async function authorViews(ids: string[]): Promise<Map<string, PostAuthorView>> {
  const unique = [...new Set(ids)];
  return new Map(await Promise.all(unique.map(async (id) => [id, await userBriefView(id)] as const)));
}
const authorView = async (item: Post | Comment): Promise<PostAuthorView> => userBriefView(item.authorId);

const normTag = (t: string) => t.trim().replace(/^#/, '').toLowerCase();
const excerptOf = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function createPostsService(repo: PostsRepository = postsRepository) {
  /** Ai được thấy nội dung đã bị ẩn: tác giả và mod trở lên. */
  async function canSeeHidden(item: Post | Comment, courseId: string, viewerId: string | undefined) {
    if (!viewerId) return false;
    if (item.authorId === viewerId) return true;
    return atLeast(await getRole(viewerId, courseId), 'mod');
  }

  function pollView(post: Post, votes: Map<string, string[]>, viewerId: string | undefined): PollView | undefined {
    const poll = post.poll;
    if (!poll) return undefined;
    const counts = new Map<string, number>();
    for (const ids of votes.values()) for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    return {
      ...poll,
      options: poll.options.map((o) => ({ ...o, count: counts.get(o.id) ?? 0 })),
      totalVoters: votes.size,
      isClosed: !!poll.closesAt && new Date(poll.closesAt).getTime() <= Date.now(),
      viewerVotes: viewerId ? [...(votes.get(viewerId) ?? [])] : [],
    };
  }

  /** Dựng view cho nhiều bài với số truy vấn cố định (like của viewer, phiếu bình chọn, tên tác giả gom theo lô). */
  async function toViews(posts: Post[], viewerId: string | undefined): Promise<PostView[]> {
    if (posts.length === 0) return [];
    const [liked, votes, authors] = await Promise.all([
      viewerId ? repo.likedPostIds(posts.map((p) => p.id), viewerId) : Promise.resolve(new Set<string>()),
      repo.getVotesMany(posts.filter((p) => p.poll).map((p) => p.id)),
      authorViews(posts.map((p) => p.authorId)),
    ]);
    return posts.map((post) => {
      const { poll: _poll, ...rest } = post;
      return {
        ...rest,
        author: authors.get(post.authorId)!,
        viewerLiked: liked.has(post.id),
        shareUrl: postPath(post),
        poll: pollView(post, votes.get(post.id) ?? new Map(), viewerId),
      };
    });
  }
  const toView = async (post: Post, viewerId: string | undefined): Promise<PostView> => (await toViews([post], viewerId))[0]!;

  const service = {
    async list(courseId: string, query: ListPostsQuery, viewerId: string | undefined) {
      await courseService.getById(courseId);
      // Bài ẩn chỉ hiện với tác giả + mod trở lên (lọc/sắp xếp/phân trang đều ở DB).
      const seeHidden = viewerId ? atLeast(await getRole(viewerId, courseId), 'mod') : false;
      const { items, total } = await repo.list({
        courseId,
        category: query.category,
        tag: query.tag ? normTag(query.tag) : undefined,
        sort: query.sort,
        page: query.page,
        limit: query.limit,
        seeHidden,
        viewerId,
      });
      const data = await toViews(items, viewerId);
      return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) } };
    },

    async popularTags(courseId: string) {
      await courseService.getById(courseId);
      const rows = await repo.popularTags(courseId, 20);
      return rows.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    },

    async create(
      courseId: string,
      authorId: string,
      content: string,
      category: PostCategory,
      tags: string[],
      imageUrl?: string,
      pollBody?: CreatePollBody,
    ): Promise<PostView> {
      let poll: PollDef | undefined;
      if (pollBody) {
        if (pollBody.closesAt && new Date(pollBody.closesAt).getTime() <= Date.now()) {
          throw HttpError.badRequest('Thời gian đóng bình chọn phải ở tương lai');
        }
        poll = {
          question: pollBody.question,
          options: pollBody.options.map((text) => ({ id: randomUUID(), text })),
          multiple: pollBody.multiple,
          closesAt: pollBody.closesAt,
        };
      }
      const post = await repo.create(courseId, authorId, content, category, tags, imageUrl, poll);
      await pointsService.award(authorId, courseId, 'post');
      return toView(post, authorId);
    },

    async getOrThrow(postId: string): Promise<Post> {
      const post = await repo.findById(postId);
      if (!post) throw HttpError.notFound('Không tìm thấy bài viết');
      return post;
    },

    /** Như getOrThrow nhưng bài đang bị ẩn thì coi như không tồn tại với người không có quyền thấy. */
    async getVisibleOrThrow(postId: string, viewerId: string): Promise<Post> {
      const post = await this.getOrThrow(postId);
      if (post.hidden && !(await canSeeHidden(post, post.courseId, viewerId))) throw HttpError.notFound('Không tìm thấy bài viết');
      return post;
    },

    async getView(postId: string, viewerId: string): Promise<PostView> {
      return toView(await this.getVisibleOrThrow(postId, viewerId), viewerId);
    },

    async share(postId: string, viewerId: string) {
      const post = await this.getVisibleOrThrow(postId, viewerId);
      const author = await authorView(post);
      return { url: postPath(post), title: `${author.name} — ${post.category}`, excerpt: excerptOf(post.content) };
    },

    async update(postId: string, actorId: string, patch: UpdatePostBody): Promise<PostView> {
      const post = await this.getOrThrow(postId);
      if (!(await canManageContent(actorId, post.courseId, post.authorId))) throw HttpError.forbidden('Bạn chỉ được sửa bài viết của mình');
      const updated = await repo.update(postId, patch);
      return toView(updated!, actorId);
    },

    async remove(postId: string, actorId: string): Promise<void> {
      const post = await this.getOrThrow(postId);
      if (!(await canManageContent(actorId, post.courseId, post.authorId))) throw HttpError.forbidden('Bạn chỉ được xóa bài viết của mình');
      await repo.delete(postId);
    },

    /** Dùng cho route hide/unhide và cho module kiểm duyệt (xử lý báo cáo). Không kiểm quyền — caller tự kiểm. */
    async setHidden(postId: string, hidden: boolean) {
      await this.getOrThrow(postId);
      await repo.setHidden(postId, hidden);
      return { hidden };
    },

    async toggleLike(postId: string, viewerId: string) {
      const post = await this.getVisibleOrThrow(postId, viewerId);
      const liked = await repo.toggleLike(postId, viewerId);
      // Bài của thành viên minh họa (User.isDemo) vẫn nhận like nhưng không cộng điểm/thông báo (họ không phải người thật).
      // Chỉ cộng điểm + thông báo ở lần like đầu của mỗi cặp (user, bài) để bấm like/unlike liên tục không spam/farm điểm.
      if (liked && post.authorId !== viewerId && !(await userRepository.findById(post.authorId))?.isDemo) {
        if (await repo.markLikeNotified(postId, viewerId)) {
          await pointsService.award(post.authorId, post.courseId, 'like_received');
          const liker = await userBriefView(viewerId);
          notify({
            userId: post.authorId,
            type: 'post_liked',
            title: 'Bài viết của bạn được yêu thích',
            body: `${liker.name} đã thích bài viết của bạn`,
            link: postPath(post),
            courseId: post.courseId,
          });
        }
      }
      const fresh = await this.getOrThrow(postId);
      return { liked, likesCount: fresh.likesCount };
    },

    async togglePin(postId: string) {
      const post = await this.getOrThrow(postId);
      const nextPinned = !post.pinned;
      await repo.setPinned(postId, nextPinned);
      return { pinned: nextPinned };
    },

    async listComments(postId: string, viewerId: string): Promise<CommentView[]> {
      const post = await this.getVisibleOrThrow(postId, viewerId);
      const isMod = atLeast(await getRole(viewerId, post.courseId), 'mod');
      const comments = (await repo.listComments(postId)).filter((c) => !c.hidden || isMod || c.authorId === viewerId);
      const authors = await authorViews(comments.map((c) => c.authorId));
      return comments.map((c) => ({ ...c, author: authors.get(c.authorId)! }));
    },

    async addComment(postId: string, authorId: string, content: string): Promise<CommentView> {
      const post = await this.getVisibleOrThrow(postId, authorId);
      const comment = await repo.addComment(postId, authorId, content);
      if (post.authorId !== authorId && !(await userRepository.findById(post.authorId))?.isDemo) {
        const who = await userBriefView(authorId);
        notify({
          userId: post.authorId,
          type: 'post_commented',
          title: 'Bình luận mới',
          body: `${who.name} đã bình luận: ${excerptOf(content, 80)}`,
          link: postPath(post),
          courseId: post.courseId,
        });
      }
      return { ...comment, author: await authorView(comment) };
    },

    async getCommentOrThrow(commentId: string): Promise<{ comment: Comment; post: Post }> {
      const comment = await repo.findComment(commentId);
      if (!comment) throw HttpError.notFound('Không tìm thấy bình luận');
      return { comment, post: await this.getOrThrow(comment.postId) };
    },

    async updateComment(commentId: string, actorId: string, content: string): Promise<CommentView> {
      const { comment, post } = await this.getCommentOrThrow(commentId);
      if (!(await canManageContent(actorId, post.courseId, comment.authorId))) throw HttpError.forbidden('Bạn chỉ được sửa bình luận của mình');
      const updated = await repo.updateComment(commentId, content);
      return { ...updated!, author: await authorView(updated!) };
    },

    async removeComment(commentId: string, actorId: string): Promise<void> {
      const { comment, post } = await this.getCommentOrThrow(commentId);
      if (!(await canManageContent(actorId, post.courseId, comment.authorId))) throw HttpError.forbidden('Bạn chỉ được xóa bình luận của mình');
      await repo.deleteComment(commentId);
    },

    /** Như setHidden nhưng cho bình luận — module kiểm duyệt dùng. Không kiểm quyền. */
    async setCommentHidden(commentId: string, hidden: boolean) {
      await this.getCommentOrThrow(commentId);
      await repo.setCommentHidden(commentId, hidden);
      return { hidden };
    },

    async vote(postId: string, viewerId: string, optionIds: string[]): Promise<PostView> {
      const post = await this.getVisibleOrThrow(postId, viewerId);
      const poll = post.poll;
      if (!poll) throw HttpError.badRequest('Bài viết này không có bình chọn');
      if (poll.closesAt && new Date(poll.closesAt).getTime() <= Date.now()) throw HttpError.conflict('Bình chọn đã đóng');
      const unique = [...new Set(optionIds)];
      const valid = new Set(poll.options.map((o) => o.id));
      if (unique.some((id) => !valid.has(id))) throw HttpError.badRequest('Lựa chọn không hợp lệ');
      if (!poll.multiple && unique.length !== 1) throw HttpError.badRequest('Bình chọn này chỉ được chọn 1 đáp án');
      await repo.setVote(postId, viewerId, unique);
      return toView(post, viewerId);
    },
  };
  return service;
}

export const postsService = createPostsService();
