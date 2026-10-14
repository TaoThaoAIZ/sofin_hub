import { apiGet } from '../../lib/api';
import type { ToolCatalog } from './catalog';

export const fetchTools = (signal?: AbortSignal) =>
  apiGet<{ data: ToolCatalog }>('/tools', undefined, signal, { skipAuthRetry: true }).then((r) => r.data);
