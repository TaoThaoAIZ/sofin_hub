import type { Prisma } from '../../src/generated/prisma/client.js';
import type { PostCategory } from '../../src/generated/prisma/enums.js';
import type { SeedContext } from './context.js';
import { DEMO_NAMES, demoUserId } from './demo-ids.js';

/**
 * Bài viết + bình luận + like + bình chọn + báo cáo minh họa (thay cho posts.seed.ts/moderation "sinh lười").
 *
 * 1) MỌI cộng đồng (Course chưa xóa mềm) có 4 bài do thành viên minh họa (User.isDemo) viết, kèm like/bình luận thật;
 *    likesCount/commentsCount được tính lại từ bản ghi PostLike/PostComment nên luôn nhất quán.
 * 2) Riêng `photo`: kịch bản test thủ công gắn với các tài khoản test (member1..3, mod, owner) — xem `seedPhotoScenario`.
 *
 * Idempotent: id xác định (`seed-post-...`) + createMany(skipDuplicates); chạy lại không nhân đôi và không ghi đè dữ liệu người dùng đã sửa.
 * Yêu cầu seedDemoMembers đã chạy trước (User `demo-<communityId>-<i>` + Enrollment).
 */
const N = DEMO_NAMES.length;
const HOUR = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR);
const ahead = (hours: number) => new Date(Date.now() + hours * HOUR);

interface PostRow {
  id: string;
  communityId: string;
  authorId: string;
  content: string;
  category: PostCategory;
  tags: string[];
  imageUrl?: string;
  pinned?: boolean;
  hidden?: boolean;
  poll?: Prisma.InputJsonValue;
  createdAt: Date;
}
interface CommentRow {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  hidden?: boolean;
  createdAt: Date;
}
interface LikeRow {
  postId: string;
  userId: string;
}

const COMMENT_TEXTS = (instructor: string) => [
  'Cảm ơn bạn đã chia sẻ, rất hữu ích!',
  `Đúng rồi, ${instructor} dạy dễ hiểu lắm.`,
  'Mình cũng đang thắc mắc y chang, hóng câu trả lời.',
];

/** Bài minh họa của 1 cộng đồng: [tác giả (chỉ số thành viên minh họa), nội dung, thể loại, thẻ, ghim, số like, số bình luận]. */
function demoPosts(communityId: string, title: string, instructor: string) {
  const author = (i: number) => demoUserId(communityId, i % N);
  const specs: { i: number; content: string; category: PostCategory; tags: string[]; pinned: boolean; likes: number; comments: number }[] = [
    {
      i: 0,
      content: `Chào mừng cả nhà đến với cộng đồng "${title}"! Đây là nơi mình chia sẻ tài liệu, trả lời câu hỏi và cùng mọi người thực hành. Đọc kỹ mục Lớp học để bắt đầu đúng lộ trình nhé.`,
      category: 'announcement',
      tags: ['#ChàoMừng', '#BắtĐầu'],
      pinned: true,
      likes: 24,
      comments: 3,
    },
    {
      i: 1,
      content: `Mình mới học xong module đầu tiên, áp dụng thử luôn và thấy hiệu quả rõ rệt! Cảm ơn ${instructor} đã hướng dẫn chi tiết.`,
      category: 'case_study',
      tags: ['#KếtQuả', '#ChiaSẻ'],
      pinned: false,
      likes: 15,
      comments: 2,
    },
    {
      i: 2,
      content: 'Cho mình hỏi có tài liệu tổng hợp cho phần nâng cao không ạ? Mình muốn ôn lại trước khi qua module tiếp theo.',
      category: 'qa',
      tags: ['#HỏiĐáp'],
      pinned: false,
      likes: 6,
      comments: 1,
    },
    {
      i: 3,
      content: 'Có ai rảnh cuối tuần này không, mình muốn lập nhóm nhỏ thực hành cùng nhau cho dễ nhớ bài.',
      category: 'general',
      tags: ['#Networking'],
      pinned: false,
      likes: 9,
      comments: 0,
    },
  ];
  const posts: PostRow[] = [];
  const comments: CommentRow[] = [];
  const likes: LikeRow[] = [];
  specs.forEach((s, k) => {
    const id = `seed-post-${communityId}-${k}`;
    posts.push({ id, communityId, authorId: author(s.i), content: s.content, category: s.category, tags: s.tags, pinned: s.pinned, createdAt: ago((k + 1) * 7) });
    for (let j = 0; j < s.likes; j++) likes.push({ postId: id, userId: author(s.i + 1 + j) });
    const texts = COMMENT_TEXTS(instructor);
    for (let j = 0; j < Math.min(s.comments, texts.length); j++) {
      comments.push({ id: `seed-comment-${communityId}-${k}-${j}`, postId: id, authorId: author(s.i + 4 + j), content: texts[j]!, createdAt: ago(j + 1) });
    }
  });
  return { posts, comments, likes };
}

/** Kịch bản thủ công ở `photo` (tài khoản test). Trả về các bản ghi cần chèn. */
function photoScenario(u: SeedContext['userIds']) {
  const communityId = 'photo';
  const demo = (i: number) => demoUserId(communityId, i);
  const posts: PostRow[] = [];
  const comments: CommentRow[] = [];
  const likes: LikeRow[] = [];
  const reports: Prisma.ReportCreateManyInput[] = [];
  const votes: { postId: string; userId: string; optionId: string }[] = [];

  // 1) Bài của member1 có ảnh + thẻ, được like, member2 bình luận.
  const image = 'seed-post-photo-m1-image';
  posts.push({
    id: image,
    communityId,
    authorId: u.member1,
    content: 'Mình vừa chụp bộ ảnh hoàng hôn ở Đà Nẵng bằng khẩu 50mm f/1.8. Mọi người góp ý bố cục giúp mình nhé!',
    category: 'case_study',
    tags: ['#HoàngHôn', '#Portrait', '#ChiaSẻ'],
    imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200',
    createdAt: ago(5),
  });
  likes.push({ postId: image, userId: u.member2 }, { postId: image, userId: u.member3 }, { postId: image, userId: u.mod }, { postId: image, userId: demo(1) }, { postId: image, userId: demo(2) });
  comments.push(
    { id: 'seed-comment-photo-m2-on-m1-image', postId: image, authorId: u.member2, content: 'Bố cục đẹp quá, màu trời rất có hồn!', createdAt: ago(4) },
    { id: 'seed-comment-photo-demo-on-m1-image', postId: image, authorId: demo(3), content: 'Cảm ơn bạn đã chia sẻ, rất hữu ích!', createdAt: ago(3) },
  );

  // 2) Bài của member1 có POLL đang mở (member2 đã vote đáp án 1).
  const poll = 'seed-post-photo-m1-poll';
  posts.push({
    id: poll,
    communityId,
    authorId: u.member1,
    content: 'Cuối tuần này cả nhóm đi chụp ở đâu? Bình chọn giúp mình nhé.',
    category: 'general',
    tags: ['#Networking', '#ĐiChụp'],
    poll: {
      question: 'Địa điểm chụp cuối tuần?',
      options: [
        { id: 'seed-photo-poll-o1', text: 'Phố cổ Hà Nội' },
        { id: 'seed-photo-poll-o2', text: 'Bãi biển Mỹ Khê' },
        { id: 'seed-photo-poll-o3', text: 'Đồi chè Mộc Châu' },
      ],
      multiple: false,
      closesAt: ahead(24 * 30).toISOString(),
    },
    createdAt: ago(3),
  });
  votes.push(
    { postId: poll, userId: u.member2, optionId: 'seed-photo-poll-o1' },
    { postId: poll, userId: demo(1), optionId: 'seed-photo-poll-o1' },
    { postId: poll, userId: demo(2), optionId: 'seed-photo-poll-o2' },
  );

  // 3) Bài của member1 BỊ ẨN (mod đã xử lý báo cáo hide_content của member2).
  const hidden = 'seed-post-photo-m1-hidden';
  posts.push({
    id: hidden,
    communityId,
    authorId: u.member1,
    content: 'Mua ngay khóa học chụp ảnh giá rẻ tại link này, giảm 90% chỉ hôm nay!!!',
    category: 'general',
    tags: ['#QuảngCáo'],
    hidden: true,
    createdAt: ago(20),
  });
  reports.push({
    id: 'seed-report-photo-resolved',
    communityId: communityId,
    targetType: 'post',
    targetId: hidden,
    targetUserId: u.member1,
    targetExcerpt: 'Mua ngay khóa học chụp ảnh giá rẻ tại link này, giảm 90% chỉ hôm nay!!!',
    reporterId: u.member2,
    reason: 'spam',
    detail: 'Quảng cáo, không liên quan.',
    status: 'resolved',
    action: 'hide_content',
    note: 'Đã ẩn bài quảng cáo.',
    resolvedById: u.mod,
    resolvedAt: ago(18),
    createdAt: ago(19),
  });

  // 4) Bài đã được GHIM (owner, thông báo).
  const pinned = 'seed-post-photo-owner-pinned';
  posts.push({
    id: pinned,
    communityId,
    authorId: u.owner,
    content: 'Nội quy cộng đồng Nhiếp ảnh: tôn trọng nhau, không quảng cáo, gắn thẻ đúng chủ đề. Vi phạm sẽ bị ẩn bài hoặc cấm.',
    category: 'announcement',
    tags: ['#NộiQuy'],
    pinned: true,
    createdAt: ago(48),
  });
  likes.push({ postId: pinned, userId: u.member1 }, { postId: pinned, userId: u.member2 });

  // 5) Báo cáo ĐANG CHỜ (member3 báo cáo bài ảnh của member1).
  reports.push({
    id: 'seed-report-photo-open',
    communityId: communityId,
    targetType: 'post',
    targetId: image,
    targetUserId: u.member1,
    targetExcerpt: 'Mình vừa chụp bộ ảnh hoàng hôn ở Đà Nẵng bằng khẩu 50mm f/1.8. Mọi người góp ý bố cục giúp mình nhé!',
    reporterId: u.member3,
    reason: 'inappropriate',
    detail: 'Ảnh nghi lấy từ nguồn khác (kịch bản test: mod xử lý báo cáo này).',
    status: 'open',
    createdAt: ago(1),
  });

  return { posts, comments, likes, reports, votes };
}

export async function seedPosts(ctx: SeedContext): Promise<void> {
  const { db } = ctx;
  const courses = await db.community.findMany({ where: { deletedAt: null, moderationStatus: { not: 'draft' } }, select: { id: true, title: true, instructorName: true } });

  const posts: PostRow[] = [];
  const comments: CommentRow[] = [];
  const likes: LikeRow[] = [];
  for (const c of courses) {
    const d = demoPosts(c.id, c.title, c.instructorName);
    posts.push(...d.posts);
    comments.push(...d.comments);
    likes.push(...d.likes);
  }

  let reports: Prisma.ReportCreateManyInput[] = [];
  let votes: { postId: string; userId: string; optionId: string }[] = [];
  if (courses.some((c) => c.id === 'photo')) {
    const s = photoScenario(ctx.userIds);
    posts.push(...s.posts);
    comments.push(...s.comments);
    likes.push(...s.likes);
    reports = s.reports;
    votes = s.votes;
  }

  // Chỉ chèn like/bình luận cho người có tồn tại (demo member có thể chưa được tạo nếu seedDemoMembers bị bỏ qua).
  const userIds = new Set((await db.user.findMany({ select: { id: true } })).map((u) => u.id));
  const okUser = (id: string) => userIds.has(id);
  const CHUNK = 1000;
  const insert = async <T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>) => {
    for (let i = 0; i < rows.length; i += CHUNK) await fn(rows.slice(i, i + CHUNK));
  };

  const postRows = posts.filter((p) => okUser(p.authorId));
  const postIds = new Set(postRows.map((p) => p.id));
  await insert(postRows, (chunk) =>
    db.post.createMany({
      data: chunk.map((p) => ({
        id: p.id,
        communityId: p.communityId,
        authorId: p.authorId,
        content: p.content,
        category: p.category,
        tags: p.tags,
        imageUrl: p.imageUrl,
        pinned: p.pinned ?? false,
        hidden: p.hidden ?? false,
        poll: p.poll,
        createdAt: p.createdAt,
      })),
      skipDuplicates: true,
    }),
  );
  await insert(
    comments.filter((c) => postIds.has(c.postId) && okUser(c.authorId)),
    (chunk) => db.postComment.createMany({ data: chunk.map((c) => ({ ...c, hidden: c.hidden ?? false })), skipDuplicates: true }),
  );
  await insert(
    likes.filter((l) => postIds.has(l.postId) && okUser(l.userId)),
    (chunk) => db.postLike.createMany({ data: chunk, skipDuplicates: true }),
  );
  await insert(votes.filter((v) => postIds.has(v.postId) && okUser(v.userId)), (chunk) => db.pollVote.createMany({ data: chunk, skipDuplicates: true }));
  await insert(reports.filter((r) => postIds.has(r.targetId) && okUser(r.reporterId)), (chunk) => db.report.createMany({ data: chunk, skipDuplicates: true }));

  // Đếm phi chuẩn hóa tính lại từ bản ghi -> luôn khớp (chỉ cho bài seed).
  await db.$executeRaw`
    UPDATE "Post" p SET
      "likesCount" = (SELECT count(*)::int FROM "PostLike" l WHERE l."postId" = p."id"),
      "commentsCount" = (SELECT count(*)::int FROM "PostComment" c WHERE c."postId" = p."id")
    WHERE p."id" LIKE 'seed-post-%'`;
}
