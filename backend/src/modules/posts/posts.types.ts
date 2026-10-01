export const POST_CATEGORIES = [
  'Thảo luận chung',
  'Hỏi đáp',
  'Case study',
  'Thông báo',
] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

export interface PollOption {
  id: string;
  text: string;
}

export interface PollDef {
  question?: string;
  options: PollOption[];
  /** true = được chọn nhiều đáp án. */
  multiple: boolean;
  /** ISO 8601; sau mốc này không bình chọn/đổi lựa chọn được nữa. */
  closesAt?: string;
}

export interface Post {
  id: string;
  communityId: string;
  /** @deprecated alias của communityId (tương thích JSON cũ) — repository luôn điền. */
  courseId?: string;
  authorId: string;
  content: string;
  category: PostCategory;
  imageUrl?: string;
  tags: string[];
  pinned: boolean;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  editedAt?: string;
  /** Bị mod ẩn: chỉ tác giả + mod trở lên còn thấy. */
  hidden?: boolean;
  poll?: PollDef;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: string;
  editedAt?: string;
  hidden?: boolean;
}

export interface PostAuthorView {
  id: string;
  name: string;
}

export interface PollView extends PollDef {
  options: (PollOption & { count: number })[];
  totalVoters: number;
  isClosed: boolean;
  /** Các option viewer đã chọn (không lộ ai khác chọn gì). */
  viewerVotes: string[];
}

export type PostView = Omit<Post, 'poll'> & {
  author: PostAuthorView;
  viewerLiked: boolean;
  shareUrl: string;
  poll?: PollView;
};
export type CommentView = Comment & { author: PostAuthorView };
