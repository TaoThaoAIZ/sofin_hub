// Lưu mã giới thiệu (từ link /gioi-thieu/:code hoặc ?ref=) cho tới khi người dùng đăng ký. Chỉ là bộ nhớ tạm của trình duyệt:
// việc ghi nhận thật (cửa sổ hiệu lực, chống tự giới thiệu) do server làm khi nhận `referralCode` ở POST /auth/register.
const KEY = 'sofin:referral';
/** Quá hạn này thì bỏ mã đã lưu (khớp mặc định `referral.attributionDays`; server vẫn tự tính cửa sổ từ lúc đăng ký). */
const MAX_AGE_MS = 60 * 86_400_000;

export function saveReferralCode(code: string) {
  const clean = code.trim().toLowerCase().slice(0, 64);
  if (!clean) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ code: clean, at: Date.now() }));
  } catch {
    /* trình duyệt chặn lưu trữ: bỏ qua */
  }
}

export function readReferralCode(): string | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const v = JSON.parse(raw) as { code?: unknown; at?: unknown };
    if (typeof v.code !== 'string' || typeof v.at !== 'number' || Date.now() - v.at > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return undefined;
    }
    return v.code;
  } catch {
    return undefined;
  }
}

/** Id cộng đồng hợp lệ trên link giới thiệu (`?c=`): chỉ chữ, số, gạch; tránh nhét đường dẫn lạ vào điều hướng. */
export const isCommunityId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);

const COMMUNITY_KEY = 'sofin:referral-community';

/** Nhớ cộng đồng của link giới thiệu cho tới khi người mới đăng ký xong, để đưa họ vào đúng cộng đồng đó. */
export function saveReferralCommunity(communityId: string) {
  if (!isCommunityId(communityId)) return;
  try {
    localStorage.setItem(COMMUNITY_KEY, JSON.stringify({ id: communityId, at: Date.now() }));
  } catch {
    /* trình duyệt chặn lưu trữ: bỏ qua */
  }
}

/** Trang đích sau khi đăng ký: cộng đồng của link giới thiệu (nếu có và còn hạn). */
export function readReferralDestination(): string | undefined {
  try {
    const raw = localStorage.getItem(COMMUNITY_KEY);
    if (!raw) return undefined;
    const v = JSON.parse(raw) as { id?: unknown; at?: unknown };
    if (!isCommunityId(v.id) || typeof v.at !== 'number' || Date.now() - v.at > MAX_AGE_MS) {
      localStorage.removeItem(COMMUNITY_KEY);
      return undefined;
    }
    return `/communities/${v.id}`;
  } catch {
    return undefined;
  }
}

export function clearReferralCode() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(COMMUNITY_KEY);
  } catch {
    /* bỏ qua */
  }
}
