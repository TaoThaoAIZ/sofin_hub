import { createContext, useContext, type ReactNode } from 'react';
import type { PopupTone } from './Popup';

export interface ConfirmOptions {
  title?: ReactNode;
  message?: ReactNode;
  tone?: PopupTone;
  confirmText?: string;
  cancelText?: string;
  icon?: string | false;
}

export interface MessageOptions {
  title?: ReactNode;
  message: ReactNode;
  tone?: PopupTone;
  okText?: string;
  icon?: string | false;
}

export interface PopupApi {
  /** Thay `window.confirm`: `if (!(await confirm({...}))) return;` */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** Thay `window.alert`: resolve khi người dùng đóng. */
  message: (opts: MessageOptions) => Promise<void>;
}

export const PopupContext = createContext<PopupApi | null>(null);

export function usePopup(): PopupApi {
  const ctx = useContext(PopupContext);
  if (!ctx) throw new Error('usePopup phải nằm trong <PopupProvider>');
  return ctx;
}
