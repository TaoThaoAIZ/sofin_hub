import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { RequireAuth } from '../features/auth/RequireAuth';
import { CreateWizard } from '../features/wizard/CreateWizard';

/** /communities/new[?draft=<id>] — wizard 5 bước tạo cộng đồng (cần đăng nhập; mở lại bản nháp bằng ?draft=). */
export function CreateCommunityPage() {
  return (
    <div
      className="min-h-screen pb-6"
      style={{
        background:
          'radial-gradient(700px 500px at 0% 20%, rgba(255,186,140,.3), transparent 70%), radial-gradient(700px 600px at 100% 30%, rgba(251,207,232,.28), transparent 70%), #faf8f6',
      }}
    >
      <Header active="myCommunities" />
      <RequireAuth>
        <CreateWizard />
      </RequireAuth>
      <Footer />
    </div>
  );
}
