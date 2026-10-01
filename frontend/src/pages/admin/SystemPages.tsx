import { AuditView } from '../../features/admin/pages/AuditView';
import { EmailTemplatesView } from '../../features/admin/pages/EmailTemplatesView';
import { AdminAccountsView, RolesView } from '../../features/admin/pages/SystemAccessViews';
import { FlagsView, IntegrationsView, NotificationsView, SettingsView } from '../../features/admin/pages/SystemConfigViews';
import { CategoriesView } from '../../features/admin/pages/DiscoveryViews';

/** Nhóm Hệ thống (/admin/system/*). */
export const AdminAdminsPage = () => <AdminAccountsView />;
export const AdminRolesPage = () => <RolesView />;
/** Danh mục: dùng lại trình soạn của Khám phá, gọi endpoint /admin/system/categories. */
export const AdminSystemCategoriesPage = () => <CategoriesView base="/system/categories" />;
export const AdminFlagsPage = () => <FlagsView />;
export const AdminIntegrationsPage = () => <IntegrationsView />;
export const AdminNotificationsPage = () => <NotificationsView />;
export const AdminEmailTemplatesPage = () => <EmailTemplatesView />;
export const AdminAuditPage = () => <AuditView />;
export const AdminSettingsPage = () => <SettingsView />;
