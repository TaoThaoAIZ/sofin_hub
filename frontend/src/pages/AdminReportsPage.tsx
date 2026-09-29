import { Header } from '../components/layout/Header';
import { ReportQueue } from '../features/community/components/ModerationPanel';

/** /admin/reports — báo cáo toàn nền tảng (Platform Admin). BE trả 403 với người khác; hiển thị lỗi đó. */
export function AdminReportsPage() {
  return (
    <div className="min-h-screen bg-[#fdfbfa]">
      <Header />
      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8">
        <div>
          <h1 className="m-0 text-[28px] font-extrabold tracking-tight">Báo cáo toàn nền tảng</h1>
          <p className="mt-1 mb-0 text-sm text-stone-600">Mọi báo cáo từ tất cả cộng đồng — chỉ dành cho quản trị viên nền tảng.</p>
        </div>
        <ReportQueue courseId={null} />
      </main>
    </div>
  );
}
