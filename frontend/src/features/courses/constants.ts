import type { CategoryId, CourseFilters, CourseTag } from './types';

/** Icon + màu cho từng danh mục (path SVG viewBox 24x24, lấy từ bản UI gốc). */
export const CATEGORY_UI: Record<CategoryId, { d: string; color: string }> = {
  business: { d: 'M4 20V14h3v6zM10.5 20V9h3v11zM17 20V4h3v16z', color: '#f59e0b' },
  content: {
    d: 'M3 6.5A2.5 2.5 0 0 1 5.5 4h9A2.5 2.5 0 0 1 17 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 3 17.5zM17 10l4-2.5v9L17 14z',
    color: '#a855f7',
  },
  tech: {
    d: 'M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5V15a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15zM8 20h8M12 16.5V20',
    color: '#3b82f6',
  },
  finance: {
    d: 'M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5',
    color: '#eab308',
  },
  health: { d: 'M12 20s-8-5-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15 12 20 12 20z', color: '#f43f5e' },
  self: { d: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0z', color: '#8b5cf6' },
  hobby: { d: 'M7 8h10a5 5 0 0 1 0 10c-2 0-3-2-5-2s-3 2-5 2A5 5 0 0 1 7 8z', color: '#f97316' },
  relationships: {
    d: 'M12 20s-8-5-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15 12 20 12 20z',
    color: '#dc2626',
  },
};

export const ALL_CATEGORY_ICON = {
  d: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  color: '#f26a1b',
};

export const TAG_UI: Record<CourseTag, { label: string; bg: string; fg: string }> = {
  hot: { label: 'Hot', bg: '#ef4444', fg: '#fff' },
  bestseller: { label: 'Bán chạy', bg: '#8b5cf6', fg: '#fff' },
  new: { label: 'Mới', bg: '#dcfce7', fg: '#166534' },
};

type DropdownKey = 'pricing' | 'visibility' | 'status' | 'language' | 'sort';

export interface FilterDropdown {
  key: DropdownKey;
  label: string;
  options: { value: NonNullable<CourseFilters[DropdownKey]>; label: string }[];
}

export const FILTER_DROPDOWNS: FilterDropdown[] = [
  {
    key: 'pricing',
    label: 'Giá',
    options: [
      { value: 'free', label: 'Miễn phí' },
      { value: 'paid', label: 'Có phí' },
      { value: 'trial', label: 'Dùng thử miễn phí' },
    ],
  },
  {
    key: 'visibility',
    label: 'Loại',
    options: [
      { value: 'public', label: 'Công khai' },
      { value: 'private', label: 'Riêng tư' },
    ],
  },
  {
    key: 'status',
    label: 'Trạng thái',
    options: [
      { value: 'open', label: 'Đang mở' },
      { value: 'soon', label: 'Sắp ra mắt' },
      { value: 'completed', label: 'Đã hoàn thành' },
    ],
  },
  {
    key: 'language',
    label: 'Ngôn ngữ',
    options: [
      { value: 'vi', label: 'Tiếng Việt' },
      { value: 'en', label: 'English' },
    ],
  },
  {
    key: 'sort',
    label: 'Sắp xếp',
    options: [
      { value: 'trending', label: 'Đang nổi' },
      { value: 'top', label: 'Hàng đầu' },
      { value: 'newest', label: 'Mới nhất' },
    ],
  },
];

export const PAGE_SIZE = 12;
