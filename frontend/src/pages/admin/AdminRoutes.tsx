import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../../features/admin/components/AdminLayout';
import { AdminCommunitiesPage, AdminCommunityDetailPage, AdminCommunityReviewPage, AdminCommunitySuspendedPage, AdminCommunityTrashPage } from './CommunitiesPages';
import { AdminDashboardPage } from './DashboardPage';
import { AdminBansPage, AdminCaseDetailPage, AdminModerationQueuePage, AdminRemovalsPage, AdminSuspensionsPage, AdminWarningsPage } from './ModerationPages';
import { AdminCommentsPage, AdminCoursesPage, AdminEventsPage, AdminLessonsPage, AdminMediaPage, AdminPostsPage } from './ContentPages';
import { AdminCategoriesPage, AdminFeaturedPage, AdminListedPage, AdminRankingsPage, AdminSearchVisibilityPage } from './DiscoveryPages';
import {
  AdminChargebacksPage,
  AdminCreatorDetailPage,
  AdminCreatorsPage,
  AdminBankInflowPage,
  AdminPayoutsPage,
  AdminRefundDetailPage,
  AdminRefundsPage,
  AdminSubscriptionsPage,
  AdminTransactionDetailPage,
  AdminTransactionsPage,
} from './PaymentsPages';
import { AdminAnalyticsCommunitiesPage, AdminAnalyticsConversionPage, AdminAnalyticsEngagementPage, AdminAnalyticsRetentionPage, AdminAnalyticsRevenuePage, AdminAnalyticsUsersPage } from './AnalyticsPages';
import { AdminCreatorIssuesPage, AdminPaymentIssuesPage, AdminTicketsPage, AdminUserIssuesPage } from './SupportPages';
import { AdminAdminsPage, AdminAuditPage, AdminEmailTemplatesPage, AdminFlagsPage, AdminIntegrationsPage, AdminNotificationsPage, AdminRolesPage, AdminSettingsPage, AdminSystemCategoriesPage } from './SystemPages';
import { AdminUserDetailPage, AdminUsersBannedPage, AdminUsersPage, AdminUsersRestrictedPage } from './UsersPages';

/** Toàn bộ route /admin/* (được App.tsx tải lazy). Layout tự chặn người không phải Platform Admin. */
export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="communities" element={<AdminCommunitiesPage />} />
        <Route path="communities/review" element={<AdminCommunityReviewPage />} />
        <Route path="communities/suspended" element={<AdminCommunitySuspendedPage />} />
        <Route path="communities/trash" element={<AdminCommunityTrashPage />} />
        <Route path="communities/:id" element={<AdminCommunityDetailPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="users/restricted" element={<AdminUsersRestrictedPage />} />
        <Route path="users/banned" element={<AdminUsersBannedPage />} />
        <Route path="users/:id" element={<AdminUserDetailPage />} />
        <Route path="moderation" element={<AdminModerationQueuePage />} />
        <Route path="moderation/cases/:id" element={<AdminCaseDetailPage />} />
        <Route path="moderation/warnings" element={<AdminWarningsPage />} />
        <Route path="moderation/removals" element={<AdminRemovalsPage />} />
        <Route path="moderation/suspensions" element={<AdminSuspensionsPage />} />
        <Route path="moderation/bans" element={<AdminBansPage />} />
        <Route path="content/posts" element={<AdminPostsPage />} />
        <Route path="content/comments" element={<AdminCommentsPage />} />
        <Route path="content/courses" element={<AdminCoursesPage />} />
        <Route path="content/lessons" element={<AdminLessonsPage />} />
        <Route path="content/events" element={<AdminEventsPage />} />
        <Route path="content/media" element={<AdminMediaPage />} />
        <Route path="payments/tx" element={<AdminTransactionsPage />} />
        <Route path="payments/tx/:id" element={<AdminTransactionDetailPage />} />
        <Route path="payments/subs" element={<AdminSubscriptionsPage />} />
        <Route path="payments/refunds" element={<AdminRefundsPage />} />
        <Route path="payments/refunds/:id" element={<AdminRefundDetailPage />} />
        <Route path="payments/chargebacks" element={<AdminChargebacksPage />} />
        <Route path="payments/creator" element={<AdminCreatorsPage />} />
        <Route path="payments/creator/:userId" element={<AdminCreatorDetailPage />} />
        <Route path="payments/payouts" element={<AdminPayoutsPage />} />
        <Route path="payments/bank" element={<AdminBankInflowPage />} />
        <Route path="discovery/listed" element={<AdminListedPage />} />
        <Route path="discovery/categories" element={<AdminCategoriesPage />} />
        <Route path="discovery/featured" element={<AdminFeaturedPage />} />
        <Route path="discovery/rankings" element={<AdminRankingsPage />} />
        <Route path="discovery/seo" element={<AdminSearchVisibilityPage />} />
        <Route path="analytics/users" element={<AdminAnalyticsUsersPage />} />
        <Route path="analytics/communities" element={<AdminAnalyticsCommunitiesPage />} />
        <Route path="analytics/engagement" element={<AdminAnalyticsEngagementPage />} />
        <Route path="analytics/retention" element={<AdminAnalyticsRetentionPage />} />
        <Route path="analytics/revenue" element={<AdminAnalyticsRevenuePage />} />
        <Route path="analytics/conversion" element={<AdminAnalyticsConversionPage />} />
        <Route path="support/tickets" element={<AdminTicketsPage />} />
        <Route path="support/user" element={<AdminUserIssuesPage />} />
        <Route path="support/creator" element={<AdminCreatorIssuesPage />} />
        <Route path="support/payment" element={<AdminPaymentIssuesPage />} />
        <Route path="system/admins" element={<AdminAdminsPage />} />
        <Route path="system/roles" element={<AdminRolesPage />} />
        <Route path="system/categories" element={<AdminSystemCategoriesPage />} />
        <Route path="system/flags" element={<AdminFlagsPage />} />
        <Route path="system/integrations" element={<AdminIntegrationsPage />} />
        <Route path="system/notifications" element={<AdminNotificationsPage />} />
        <Route path="system/email" element={<AdminEmailTemplatesPage />} />
        <Route path="system/audit" element={<AdminAuditPage />} />
        <Route path="system/settings" element={<AdminSettingsPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
