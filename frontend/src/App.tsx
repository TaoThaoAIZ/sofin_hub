import { Route, Routes } from 'react-router-dom';
import { ScrollToTop } from './components/ScrollToTop';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { FaqPage } from './pages/FaqPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { RegisterPage } from './pages/RegisterPage';
import { TermsPage } from './pages/TermsPage';

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/courses/:id" element={<CourseDetailPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
