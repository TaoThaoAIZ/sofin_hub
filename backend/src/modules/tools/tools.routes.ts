import { Router } from 'express';
import { TOOL_CATEGORIES, TOOLS } from './tools.catalog.js';

export const toolsRouter = Router();

/** Danh mục tool đang bán (công khai, tĩnh). POST /tools/lead (form "Mua ngay") nằm ở module support. */
toolsRouter.get('/tools', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({ data: { categories: TOOL_CATEGORIES, tools: TOOLS } });
});
