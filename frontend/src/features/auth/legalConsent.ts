const TERMS_KEY = 'sofinhub_terms_read';
const PRIVACY_KEY = 'sofinhub_privacy_read';

function readFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    // Trình duyệt chặn storage (chế độ ẩn danh...) — bỏ qua, người dùng chỉ cần đọc lại trong phiên đó.
  }
}

export const markTermsRead = () => writeFlag(TERMS_KEY);
export const markPrivacyRead = () => writeFlag(PRIVACY_KEY);
export const hasReadTerms = () => readFlag(TERMS_KEY);
export const hasReadPrivacy = () => readFlag(PRIVACY_KEY);
