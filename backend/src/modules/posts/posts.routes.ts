import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { courseService } from '../courses/courses.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { requireRole } from '../permissions/policy.js';
import { createCommentBody, createPostBody, listPostsQuery, pollVoteBody, updatePostBody } from './posts.schema.js';
import { postsService } from './posts.service.js';

export const postsRouter = Router();

/** Nạp bài viết + bắt buộc là thành viên cộng đồng chứa bài đó. */
async function loadPostAsMember(postId: string, userId: string) {
  const post = await postsService.getOrThrow(postId);
  await enrollmentService.requireMembership(userId, post.courseId);
  return post;
}

postsRouter.get('/courses/:id/posts', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await courseService.getById(courseId);
  await enrollmentService.requireMembership(req.userId!, courseId);
  const query = listPostsQuery.parse(req.query);
  res.json(await postsService.list(courseId, query, req.userId));
});

postsRouter.get('/courses/:id/tags', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await courseService.getById(courseId);
  await enrollmentService.requireMembership(req.userId!, courseId);
  res.json({ data: await postsService.popularTags(courseId) });
});

postsRouter.post('/courses/:id/posts', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await courseService.getById(courseId);
  await enrollmentService.requireMembership(req.userId!, courseId);
  const body = createPostBody.parse(req.body);
  res.status(201).json({ data: await postsService.create(courseId, req.userId!, body.content, body.category, body.tags, body.imageUrl, body.poll) });
});

postsRouter.get('/posts/:postId', requireAuth, async (req, res) => {
  const post = await loadPostAsMember(req.params.postId as string, req.userId!);
  res.json({ data: await postsService.getView(post.id, req.userId!) });
});

postsRouter.get('/posts/:postId/share', requireAuth, async (req, res) => {
  const post = await loadPostAsMember(req.params.postId as string, req.userId!);
  res.json({ data: await postsService.share(post.id, req.userId!) });
});

postsRouter.patch('/posts/:postId', requireAuth, async (req, res) => {
  const post = await loadPostAsMember(req.params.postId as string, req.userId!);
  const body = updatePostBody.parse(req.body);
  res.json({ data: await postsService.update(post.id, req.userId!, body) });
});

postsRouter.delete('/posts/:postId', requireAuth, async (req, res) => {
  const post = await loadPostAsMember(req.params.postId as string, req.userId!);
  await postsService.remove(post.id, req.userId!);
  res.json({ data: { deleted: true } });
});

postsRouter.post('/posts/:postId/like', requireAuth, async (req, res) => {
  const post = await loadPostAsMember(req.params.postId as string, req.userId!);
  res.json({ data: await postsService.toggleLike(post.id, req.userId!) });
});

postsRouter.post('/posts/:postId/pin', requireAuth, async (req, res) => {
  const post = await loadPostAsMember(req.params.postId as string, req.userId!);
  await requireRole(req.userId!, post.courseId, 'mod'); // chỉ mod/admin/owner (hoặc Platform Admin) được ghim
  res.json({ data: await postsService.togglePin(post.id) });
});

postsRouter.post('/posts/:postId/hide', requireAuth, async (req, res) => {
  const post = await loadPostAsMember(req.params.postId as string, req.userId!);
  await requireRole(req.userId!, post.courseId, 'mod');
  res.json({ data: await postsService.setHidden(post.id, true) });
});

postsRouter.post('/posts/:postId/unhide', requireAuth, async (req, res) => {
  const post = await loadPostAsMember(req.params.postId as string, req.userId!);
  await requireRole(req.userId!, post.courseId, 'mod');
  res.json({ data: await postsService.setHidden(post.id, false) });
});

postsRouter.post('/posts/:postId/poll/vote', requireAuth, async (req, res) => {
  const post = await loadPostAsMember(req.params.postId as string, req.userId!);
  const body = pollVoteBody.parse(req.body);
  res.json({ data: await postsService.vote(post.id, req.userId!, body.optionIds) });
});

postsRouter.get('/posts/:postId/comments', requireAuth, async (req, res) => {
  const post = await loadPostAsMember(req.params.postId as string, req.userId!);
  res.json({ data: await postsService.listComments(post.id, req.userId!) });
});

postsRouter.post('/posts/:postId/comments', requireAuth, async (req, res) => {
  const post = await loadPostAsMember(req.params.postId as string, req.userId!);
  const body = createCommentBody.parse(req.body);
  res.status(201).json({ data: await postsService.addComment(post.id, req.userId!, body.content) });
});

postsRouter.patch('/comments/:commentId', requireAuth, async (req, res) => {
  const { comment, post } = await postsService.getCommentOrThrow(req.params.commentId as string);
  await enrollmentService.requireMembership(req.userId!, post.courseId);
  const body = createCommentBody.parse(req.body);
  res.json({ data: await postsService.updateComment(comment.id, req.userId!, body.content) });
});

postsRouter.delete('/comments/:commentId', requireAuth, async (req, res) => {
  const { comment, post } = await postsService.getCommentOrThrow(req.params.commentId as string);
  await enrollmentService.requireMembership(req.userId!, post.courseId);
  await postsService.removeComment(comment.id, req.userId!);
  res.json({ data: { deleted: true } });
});
