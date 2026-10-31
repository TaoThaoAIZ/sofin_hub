import { useTranslation } from 'react-i18next';

/** Tên danh mục theo ngôn ngữ hiện tại (BE chỉ trả tên tiếng Việt); id lạ thì dùng tên BE trả về. */
export function useCategoryName() {
  const { t } = useTranslation('common');
  return (c: { id: string; name: string }) => t(`categories.${c.id}`, { defaultValue: c.name });
}
