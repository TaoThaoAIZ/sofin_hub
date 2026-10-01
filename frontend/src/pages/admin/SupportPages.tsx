import { SupportView } from '../../features/admin/pages/SupportViews';

/** Nhóm Hỗ trợ: cùng một màn, khác nhóm ticket (category). */
export const AdminTicketsPage = () => <SupportView />;
export const AdminUserIssuesPage = () => <SupportView category="user" />;
export const AdminCreatorIssuesPage = () => <SupportView category="creator" />;
export const AdminPaymentIssuesPage = () => <SupportView category="payment" />;
