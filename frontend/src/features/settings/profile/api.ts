import { apiGet } from '../../../lib/api';

export interface HandleAvailability {
  available: boolean;
  reason?: 'invalid' | 'reserved' | 'taken';
}

/** Báo handle còn trống hay không (bỏ qua handle của chính mình). */
export const fetchHandleAvailability = (handle: string, signal?: AbortSignal) =>
  apiGet<{ data: HandleAvailability }>('/users/handle-available', { handle }, signal).then((r) => r.data);
