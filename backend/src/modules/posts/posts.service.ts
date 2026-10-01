import { randomUUID } from 'node:crypto';
import { HttpError } from '../../utils/http-error.js';
import { userBriefView } from '../auth/user-view.js';
import { assertUserCan } from '../auth/user-status.js';
import { catalogService } from '../catalog/catalog.service.js';
import { notify } from '../notifications/notifications.service.js';
import { releaseLikeNotice } from './posts.like-notice.js';
import { atLeast, canManageContent, getRole } from '../permissions/policy.js';
import { pointsService } from '../points/points.service.js';
import { userRepository } from '../auth/auth.repository.js';
import { postsRepository, type CommentCursor, type PollTally, type PostCursor, type PostsRepository } from './posts.repository.js';
import type { Comment, CommentView, PollDef, PollView, Post, PostAuthorView, PostCategory, PostView } from './posts.types.js';
import type { CreatePollBody, ListCommentsQuery, ListPostsQuery, UpdatePostBody } from './posts.schema.js';

/** Đường dẫn FE để mở thẳng 1 bài viết. */
export const postPath = (post: Pick<Post, 'communityId' | 'id'>) => `/courses/${post.communityId}/community?post=${post.id}`;

/** Tên tác giả lấy từ User (thành viên minh họa cũng là User thật; tài khoản đã xóa hiện "Thành viên đã xóa"). */
async function authorViews(ids: string[]): Promise<Map<string, PostAuthorView>> {
  const unique = [...new Set(ids)];
  return new Map(await Promise.all(unique.map(async (id) => [id, await userBriefView(id)] as const)));
}
const authorView = async (item: Post | Comment): Promise<PostAuthorView> => userBriefView(item.authorId);

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
function unb64(raw: string): unknown {
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw HttpError.badRequest('Mốc phân trang không hợp lệ');
  }
}
/** Cursor feed: [sort, pinned(0|1), likesCount, createdAt ISO, id]. Gắn sort để không dùng nhầm cursor của sort khác. */
const encodePostCursor = (sort: string, p: Pick<Post, 'pinned' | 'likesCount' | 'createdAt' | 'id'>) => b64([sort, p.pinned ? 1 : 0, p.likesCount, p.createdAt, p.id]);
function decodePostCursor(raw: string, sort: string): PostCursor {
  const v = unb64(raw);
  if (!Array.isArray(v) || v.length !== 5 || v[0] !== sort || (v[1] !== 0 && v[1] !== 1) || !Number.isInteger(v[2]) || typeof v[3] !== 'string' || !ISO.test(v[3]) || typeof v[4] !== 'string' || v[4].length > 100) {
    throw HttpError.badRequest('Mốc phân trang không hợp lệ');
  }
  return { pinned: v[1] === 1, likesCount: v[2] as number, createdAt: v[3], id: v[4] };
}
const encodeCommentCursor = (c: Pick<Comment, 'createdAt' | 'id'>) => b64([c.createdAt, c.id]);
function decodeCommentCursor(raw: string): CommentCursor {
  const v = unb64(raw);
  if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== 'string' || !ISO.test(v[0]) || typeof v[1] !== 'string' || v[1].length > 100) {
    throw HttpError.badRequest('Mốc phân trang không hợp lệ');
  }
  return { createdAt: v[0], id: v[1] };
}

const normTag = (t: string) => t.trim().replace(/^#/, '').toLowerCase();
const excerptOf = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function createPostsService(repo: PostsRepository = postsRepository) {
  /** Ai được thấy nội dung đã bị ẩn: tác giả và mod trở lên. */
  async function canSeeHidden(item: Post | Comment, communityId: string, viewerId: string | undefined) {
    if (!viewerId) return false;
    if (item.authorId === viewerId) return true;
    return atLeast(await getRole(viewerId, communityId), 'mod');
  }

  function pollView(post: Post, tally: PollTally | undefined): PollView | undefined {
    const poll = post.poll;
    if (!poll) return undefined;
    return {
      ...poll,
      options: poll.options.map((o) => ({ ...o, count: tally?.counts.get(o.id) ?? 0 })),
      totalVoters: tally?.totalVoters ?? 0,
      isClosed: !!poll.closesAt && new Date(poll.closesAt).getTime() <= Date.now(),
      viewerVotes: tally ? poll.options.map((o) => o.id).filter((id) => tally.viewerVotes.includes(id)) : [], // theo thứ tự lựa chọn của poll
    };
  }

  /** Dựng view cho nhiều bài với số truy vấn cố định (like của viewer, phiếu bình chọn, tên tác giả gom theo lô). */
  async function toViews(posts: Post[], viewerId: string | undefined): Promise<PostView[]> {
    if (posts.length === 0) return [];
    const [liked, votes, authors] = await Promise.all([
      viewerId ? repo.likedPostIds(posts.map((p) => p.id), viewerId) : Promise.resolve(new Set<string>()),
      repo.pollTallies(posts.filter((p) => p.poll).map((p) => p.id), viewerId),
      authorViews(posts.map((p) => p.authorId)),
    ]);
    return posts.map((post) => {
      const { poll: _poll, ...rest } = post;
      return {
        ...rest,
        author: authors.get(post.authorId)!,
        viewerLiked: liked.has(post.id),
        shareUrl: postPath(post),
        poll: pollView(post, votes.get(post.id)),
      };
    });
  }
  const toView = async (post: Post, viewerId: string | undefined): Promise<PostView> => (await toViews([post], viewerId))[0]!;

  const service = {
    async list(communityId: string, query: ListPostsQuery, viewerId: string | undefined) {
      await catalogService.requireLockState(communityId); // 404 nếu không có (không cần nạp cả Course)
      // Bài ẩn chỉ hiện với tác giả + mod trở lên (lọc/sắp xếp/phân trang đều ở DB).
      const seeHidden = viewerId ? atLeast(await getRole(viewerId, communityId), 'mod') : false;
      const { items, total, hasMore } = await repo.list({
        communityId,
        category: query.category,
        tag: query.tag ? normTag(query.tag) : undefined,
        sort: query.sort,
        page: query.page,
        limit: query.limit,
        seeHidden,
        viewerId,
        after: query.cursor ? decodePostCursor(query.cursor, query.sort) : undefined,
      });
      const data = await toViews(items, viewerId);
      const last = items[items.length - 1];
      return {
        data,
        // `hasMore`/`nextCursor` là phần thêm (additive); `page/limit/total/totalPages` giữ nguyên.
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
          hasMore,
          nextCursor: hasMore && last ? encodePostCursor(query.sort, last) : null,
        },
      };
    },

    async popularTags(communityId: string) {
      await catalogService.requireLockState(communityId);
      const rows = await repo.popularTags(communityId, 20);
      return rows.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    },

    async create(
      communityId: string,
      authorId: string,
      content: string,
      category: PostCategory,
      tags: string[],
      imageUrl?: string,
      pollBody?: CreatePollBody,
    ): Promise<PostView> {
      await assertUserCan(authorId, 'post');
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
      const post = await repo.create(communityId, authorId, content, category, tags, imageUrl, poll);
      await pointsService.award(authorId, communityId, 'post', { type: 'post', id: post.id });
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
      if (post.hidden && !(await canSeeHidden(post, post.communityId, viewerId))) throw HttpError.notFound('Không tìm thấy bài viết');
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
      if (!(await canManageContent(actorId, post.communityId, post.authorId))) throw HttpError.forbidden('Bạn chỉ được sửa bài viết của mình');
      const updated = await repo.update(postId, patch);
      return toView(updated!, actorId);
    },

    async remove(postId: string, actorId: string): Promise<void> {
      const post = await this.getOrThrow(postId);
      if (!(await canManageContent(actorId, post.communityId, post.authorId))) throw HttpError.forbidden('Bạn chỉ được xóa bài viết của mình');
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
          await pointsService.award(post.authorId, post.communityId, 'like_received', { type: 'post_like', id: `${postId}:${viewerId}` });
          const liker = await userBriefView(viewerId);
          notify({
            userId: post.authorId,
            type: 'post_liked',
            title: 'Bài viết của bạn được yêu thích',
            body: `${liker.name} đã thích bài viết của bạn`,
            link: postPath(post),
            communityId: post.communityId,
          }, { onWriteFailed: () => releaseLikeNotice(postId, viewerId) });
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

    /** Bình luận cũ → mới, tối đa `limit` mỗi lần; `meta.nextCursor` để lấy tiếp. Ẩn/lọc quyền xem ngay trong SQL. */
    async listComments(postId: string, viewerId: string, query: Pick<ListCommentsQuery, 'limit' | 'cursor'> = { limit: 100 }) {
      const post = await this.getVisibleOrThrow(postId, viewerId);
      const isMod = atLeast(await getRole(viewerId, post.communityId), 'mod');
      const { items, hasMore } = await repo.listComments(postId, {
        limit: query.limit,
        after: query.cursor ? decodeCommentCursor(query.cursor) : undefined,
        seeHidden: isMod,
        viewerId,
      });
      const authors = await authorViews(items.map((c) => c.authorId));
      const data: CommentView[] = items.map((c) => ({ ...c, author: authors.get(c.authorId)! }));
      const last = items[items.length - 1];
      return { data, meta: { limit: query.limit, hasMore, nextCursor: hasMore && last ? encodeCommentCursor(last) : null } };
    },

    async addComment(postId: string, authorId: string, content: string): Promise<CommentView> {
      await assertUserCan(authorId, 'comment');
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
          communityId: post.communityId,
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
      if (!(await canManageContent(actorId, post.communityId, comment.authorId))) throw HttpError.forbidden('Bạn chỉ được sửa bình luận của mình');
      const updated = await repo.updateComment(commentId, content);
      return { ...updated!, author: await authorView(updated!) };
    },

    async removeComment(commentId: string, actorId: string): Promise<void> {
      const { comment, post } = await this.getCommentOrThrow(commentId);
      if (!(await canManageContent(actorId, post.communityId, comment.authorId))) throw HttpError.forbidden('Bạn chỉ được xóa bình luận của mình');
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
