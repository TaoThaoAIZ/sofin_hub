import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const LANGUAGES = ['vi', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
const STORAGE_KEY = 'sofinhub.lang';

// Mỗi file src/i18n/locales/<lng>/<namespace>.json là một namespace (tên file = tên namespace).
const modules = import.meta.glob('./locales/*/*.json', { eager: true, import: 'default' }) as Record<string, Record<string, unknown>>;
const resources: Record<string, Record<string, Record<string, unknown>>> = {};
for (const [path, data] of Object.entries(modules)) {
  const m = /\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
  if (!m) continue;
  const [, lng, ns] = m as unknown as [string, string, string];
  (resources[lng] ??= {})[ns] = data;
}

function detect(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'vi' || saved === 'en') return saved;
  } catch {
    /* localStorage không khả dụng */
  }
  return 'vi';
}

void i18n.use(initReactI18next).init({
  resources,
  lng: detect(),
  fallbackLng: 'vi',
  defaultNS: 'common',
  ns: Object.keys(resources.vi ?? { common: 1 }),
  interpolation: { escapeValue: false },
  returnNull: false,
});

document.documentElement.lang = i18n.language;
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* bỏ qua */
  }
});

/** Locale cho Intl/toLocaleString theo ngôn ngữ đang chọn. */
export const currentLocale = () => (i18n.language === 'en' ? 'en-US' : 'vi-VN');

export default i18n;
