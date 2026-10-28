import { Router } from 'express';
import { optionalAuth, requireAuth } from '../../middlewares/auth.js';
import { searchRateLimit } from './search.ratelimit.js';
import { searchQuery, suggestQuery } from './search.schema.js';
import { searchService } from './search.service.js';

export const searchRouter = Router();

searchRouter.get('/search/suggest', requireAuth, searchRateLimit, async (req, res) => {
  const { q } = suggestQuery.parse(req.query);
  res.json({ data: await searchService.suggest(req.userId!, q) });
});

// Khách vẫn tìm được khóa học công khai; bài viết/thành viên chỉ trả cho người đã đăng nhập.
searchRouter.get('/search', optionalAuth, searchRateLimit, async (req, res) => {
  res.json(await searchService.search(req.userId, searchQuery.parse(req.query)));
});
