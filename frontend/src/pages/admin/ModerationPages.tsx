import { CaseDetailView } from '../../features/admin/pages/CaseDetailView';
import { ModerationLog, ModerationQueue } from '../../features/admin/pages/ModerationPages';

/** /admin/moderation (hàng đợi), /cases/:id, /warnings, /removals, /suspensions, /bans */
export const AdminModerationQueuePage = () => <ModerationQueue />;
export const AdminCaseDetailPage = () => <CaseDetailView />;
export const AdminWarningsPage = () => <ModerationLog kind="warnings" />;
export const AdminRemovalsPage = () => <ModerationLog kind="removals" />;
export const AdminSuspensionsPage = () => <ModerationLog kind="suspensions" />;
export const AdminBansPage = () => <ModerationLog kind="bans" />;
