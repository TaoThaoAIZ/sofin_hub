import { useEffect } from 'react';

function mark(el: Element) {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
  el.setAttribute('data-lpignore', 'true'); // LastPass
  el.setAttribute('data-1p-ignore', 'true'); // 1Password
  el.setAttribute('data-bwignore', 'true'); // Bitwarden
  el.setAttribute('data-form-type', 'other'); // Dashlane
}

/**
 * Trình quản lý mật khẩu (LastPass, 1Password...) chèn nút vào mọi ô nhập và mở trang riêng của extension khi bấm. Khu quản trị
 * không có form đăng nhập nên đánh dấu mọi ô nhập (kể cả ô render sau) để các extension bỏ qua. Chỉ áp dụng ở nơi gọi hook.
 */
export function useIgnorePasswordManagers() {
  useEffect(() => {
    document.querySelectorAll('input, textarea').forEach(mark);
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          mark(n);
          n.querySelectorAll('input, textarea').forEach(mark);
        });
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
}
