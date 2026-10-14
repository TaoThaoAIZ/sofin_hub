// Kiểu dữ liệu tool. Danh mục thật nằm ở backend (backend/src/modules/tools/tools.catalog.ts), đọc qua GET /api/tools — trang /tools
// và chatbot dùng chung một nguồn.
export type ToolCategory = 'Video AI' | 'Automation' | 'Voice AI' | 'VIP';

export interface DownloadTool {
  id: string;
  name: string;
  desc: string;
  icon: string;
  category: ToolCategory;
  tags: string[];
  free: boolean;
  downloadUrl?: string;
  badge?: 'HOT' | 'MỚI';
}

export interface ToolCatalog {
  categories: ToolCategory[];
  tools: DownloadTool[];
}

export const ALL_CATEGORY = 'all';
