import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LegacyCourseRedirect } from './components/LegacyCourseRedirect';
import { ScrollToTop } from './components/ScrollToTop';
import { ReferralCapture } from './features/referral/ReferralCapture';
import { ReferralLandingPage } from './features/referral/ReferralLandingPage';
import { MessagesProvider } from './features/messages/MessagesProvider';
import { NotificationsProvider } from './features/notifications/NotificationsProvider';
import { MessagesPage } from './pages/MessagesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { RevenuePage } from './pages/RevenuePage';
import { SearchPage } from './pages/SearchPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { CommunityPage } from './pages/CommunityPage';
import { CommunitySettingsPage } from './pages/CommunitySettingsPage';
import { CreateCommunityPage } from './pages/CreateCommunityPage';
import { InvitePage } from './pages/InvitePage';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { FaqPage } from './pages/FaqPage';
import { ContactPage } from './pages/ContactPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ProfilePage } from './pages/ProfilePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SettingsLayout } from './features/settings/SettingsLayout';
import { BillingTab } from './features/settings/tabs/BillingTab';
import { MyCommunitiesPage } from './pages/MyCommunitiesPage';
import { CommunitiesTab } from './features/settings/tabs/CommunitiesTab';
import { NotifyTab } from './features/settings/tabs/NotifyTab';
import { ProfileTab } from './features/settings/tabs/ProfileTab';
import { ReferralTab } from './features/settings/tabs/ReferralTab';
import { SecurityTab } from './features/settings/tabs/SecurityTab';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { RegisterPage } from './pages/RegisterPage';
import { TermsPage } from './pages/TermsPage';
import { CertificateVerifyPage } from './pages/CertificateVerifyPage';
import { LessonPage } from './pages/LessonPage';
import { ModerationPage } from './features/community/components/ModerationPanel';
import { AboutTab } from './features/community/components/AboutTab';
import { CalendarTab } from './features/community/components/CalendarTab';
import { ClassroomTab } from './features/community/components/ClassroomTab';
import { FeedTab } from './features/community/components/FeedTab';
import { LeaderboardTab } from './features/community/components/LeaderboardTab';
import { MembersTab } from './features/community/components/MembersTab';

// Khu vực admin tải theo yêu cầu (chỉ Platform Admin dùng) để không làm nặng bundle chính.
const AdminRoutes = lazy(() => import('./pages/admin/AdminRoutes'));

export default function App() {
  return (
    <NotificationsProvider>
      <MessagesProvider>
      <ScrollToTop />
      <ReferralCapture />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/communities/:id" element={<CourseDetailPage />} />
        <Route path="/communities/:id/checkout" element={<CheckoutPage />} />
        {/* URL cũ vẫn dùng được: chuyển sang đường dẫn chuẩn /communities/:id/... */}
        <Route path="/courses/:id" element={<LegacyCourseRedirect />} />
        <Route path="/courses/:id/*" element={<LegacyCourseRedirect />} />
        <Route path="/communities/new" element={<CreateCommunityPage />} />
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/communities/:id/community/cai-dat" element={<CommunitySettingsPage />} />
        <Route path="/communities/:id/community" element={<CommunityPage />}>
          <Route index element={<FeedTab />} />
          <Route path="lop-hoc" element={<ClassroomTab />} />
          <Route path="lop-hoc/:lessonId" element={<LessonPage />} />
          <Route path="kiem-duyet" element={<ModerationPage />} />
          <Route path="lich" element={<CalendarTab />} />
          <Route path="thanh-vien" element={<MembersTab />} />
          <Route path="xep-hang" element={<LeaderboardTab />} />
          <Route path="gioi-thieu" element={<AboutTab />} />
        </Route>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/settings" element={<SettingsLayout />}>
          <Route index element={<ProfileTab />} />
          <Route path="thong-bao" element={<NotifyTab />} />
          <Route path="bao-mat" element={<SecurityTab />} />
          <Route path="thanh-toan" element={<BillingTab />} />
          <Route path="cong-dong" element={<CommunitiesTab />} />
          <Route path="gioi-thieu" element={<ReferralTab />} />
        </Route>
        <Route path="/users/:id" element={<ProfilePage />} />
        <Route path="/me/communities" element={<MyCommunitiesPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/certificates/:code" element={<CertificateVerifyPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:id" element={<MessagesPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/billing" element={<Navigate to="/settings/thanh-toan" replace />} />
        <Route path="/gioi-thieu/:code" element={<ReferralLandingPage />} />
        <Route path="/communities/:id/revenue-dashboard" element={<RevenuePage />} />
        <Route path="/admin/reports" element={<Navigate to="/admin/moderation" replace />} />
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<div role="status" className="grid min-h-screen place-items-center text-stone-400">Đang tải…</div>}>
              <AdminRoutes />
            </Suspense>
          }
        />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </MessagesProvider>
    </NotificationsProvider>
  );
}
