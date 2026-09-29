import { Route, Routes } from 'react-router-dom';
import { ScrollToTop } from './components/ScrollToTop';
import { MessagesProvider } from './features/messages/MessagesProvider';
import { NotificationsProvider } from './features/notifications/NotificationsProvider';
import { AdminPage } from './pages/AdminPage';
import { BillingPage } from './pages/BillingPage';
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
import { MyCommunitiesPage } from './pages/MyCommunitiesPage';
import { ProfilePage } from './pages/ProfilePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SettingsPage } from './pages/SettingsPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { RegisterPage } from './pages/RegisterPage';
import { TermsPage } from './pages/TermsPage';
import { AdminReportsPage } from './pages/AdminReportsPage';
import { CertificateVerifyPage } from './pages/CertificateVerifyPage';
import { LessonPage } from './pages/LessonPage';
import { ModerationPage } from './features/community/components/ModerationPanel';
import { AboutTab } from './features/community/components/AboutTab';
import { CalendarTab } from './features/community/components/CalendarTab';
import { ClassroomTab } from './features/community/components/ClassroomTab';
import { FeedTab } from './features/community/components/FeedTab';
import { LeaderboardTab } from './features/community/components/LeaderboardTab';
import { MembersTab } from './features/community/components/MembersTab';

export default function App() {
  return (
    <NotificationsProvider>
      <MessagesProvider>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/courses/:id" element={<CourseDetailPage />} />
        <Route path="/courses/:id/checkout" element={<CheckoutPage />} />
        <Route path="/communities/new" element={<CreateCommunityPage />} />
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/courses/:id/community/cai-dat" element={<CommunitySettingsPage />} />
        <Route path="/courses/:id/community" element={<CommunityPage />}>
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
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/users/:id" element={<ProfilePage />} />
        <Route path="/me/communities" element={<MyCommunitiesPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/certificates/:code" element={<CertificateVerifyPage />} />
        <Route path="/admin/reports" element={<AdminReportsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:id" element={<MessagesPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/courses/:id/revenue-dashboard" element={<RevenuePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </MessagesProvider>
    </NotificationsProvider>
  );
}
