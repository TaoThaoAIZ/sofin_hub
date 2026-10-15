// Nhớ mã giới thiệu của MỘT cộng đồng (từ link /communities/<id>?cref=<mã>) cho tới khi người dùng thanh toán gói. Chỉ là bộ nhớ tạm của trình duyệt:
// server mới là nơi quyết định có ghi nhận không (chương trình bật, người mời là thành viên, người đầu tiên thắng...).
const KEY = 'sofin:community-referral';
/** Quá hạn này thì bỏ mã đã lưu. */
const MAX_AGE_MS = 30 * 86_400_000;

type Store = Record<string, { code: string; at: number }>;

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

export function saveCommunityRef(communityId: string, code: string) {
  const clean = code.trim().toLowerCase().slice(0, 64);
  if (!communityId || !clean) return;
  try {
    const store = load();
    store[communityId] = { code: clean, at: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* trình duyệt chặn lưu trữ: bỏ qua */
  }
}

export function readCommunityRef(communityId: string): string | undefined {
  const v = load()[communityId];
  if (!v || typeof v.code !== 'string' || typeof v.at !== 'number' || Date.now() - v.at > MAX_AGE_MS) return undefined;
  return v.code;
}
