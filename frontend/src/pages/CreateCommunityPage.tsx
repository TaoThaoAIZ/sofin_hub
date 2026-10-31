import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { RequireAuth } from '../features/auth/RequireAuth';
import { CreateWizard } from '../features/wizard/CreateWizard';

/** /communities/new[?draft=<id>] — wizard 5 bước tạo cộng đồng (cần đăng nhập; mở lại bản nháp bằng ?draft=). */
export function CreateCommunityPage() {
  return (
    <div
      className="min-h-screen pb-6"
    >
      <Header active="myCommunities" />
      <RequireAuth>
        <CreateWizard />
      </RequireAuth>
      <Footer />
    </div>
  );
}
