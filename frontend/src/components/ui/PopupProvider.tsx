import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ConfirmPopup, MessagePopup } from './Popup';
import { PopupContext, type ConfirmOptions, type MessageOptions, type PopupApi } from './usePopup';

type Active =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'message'; opts: MessageOptions; resolve: () => void };

/** Đặt một lần ở gốc app; popup hiện lần lượt (hàng đợi) nếu gọi nhiều cái cùng lúc. */
export function PopupProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Active | null>(null);
  const queue = useRef<Active[]>([]);
  const activeRef = useRef<Active | null>(null);
  activeRef.current = active;

  const push = useCallback((item: Active) => {
    if (activeRef.current) queue.current.push(item);
    else {
      activeRef.current = item;
      setActive(item);
    }
  }, []);

  const api = useMemo<PopupApi>(
    () => ({
      confirm: (opts) => new Promise<boolean>((resolve) => push({ kind: 'confirm', opts, resolve })),
      message: (opts) => new Promise<void>((resolve) => push({ kind: 'message', opts, resolve })),
    }),
    [push],
  );

  const close = (result: boolean) => {
    if (active?.kind === 'confirm') active.resolve(result);
    else active?.resolve();
    const nextItem = queue.current.shift() ?? null;
    activeRef.current = nextItem;
    setActive(nextItem);
  };

  return (
    <PopupContext.Provider value={api}>
      {children}
      {active?.kind === 'confirm' && (
        <ConfirmPopup open {...active.opts} onConfirm={() => close(true)} onCancel={() => close(false)} />
      )}
      {active?.kind === 'message' && <MessagePopup open {...active.opts} onClose={() => close(false)} />}
    </PopupContext.Provider>
  );
}
