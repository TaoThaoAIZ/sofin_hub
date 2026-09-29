import { useState } from 'react';
import { Header } from '../components/layout/Header';
import { RequireLogin } from '../components/layout/RequireLogin';
import { LockTab, PayoutsTab, RefundsTab } from '../features/admin/components/AdminTabs';
import { useIsPlatformAdmin } from '../features/admin/queries';
import { ReportQueue } from '../features/community/components/ModerationPanel';

const TABS = [
  { key: 'refunds', label: 'Hoàn tiền' },
  { key: 'payouts', label: 'Rút tiền' },
  { key: 'reports', label: 'Báo cáo vi phạm' },
  { key: 'lock', label: 'Khóa cộng đồng' },
] as const;

function AdminInner() {
  const { isAdmin, isLoading } = useIsPlatformAdmin();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('refunds');

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="mx-auto max-w-[900px] px-4 py-8 md:px-0">
        <h1 className="text-2xl font-extrabold">Quản trị nền tảng</h1>
        {isLoading && <p className="py-16 text-center text-stone-400">Đang kiểm tra quyền…</p>}
        {!isLoading && !isAdmin && (
          <p className="glass mt-6 rounded-2xl py-12 text-center text-stone-600">Bạn không có quyền truy cập khu vực quản trị.</p>
        )}
        {isAdmin && (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`h-10 rounded-xl border px-4 text-[13.5px] ${tab === t.key ? 'border-transparent bg-brand font-bold text-white' : 'border-[rgba(120,60,20,.12)] bg-white font-medium'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="mt-4">
              {tab === 'refunds' && <RefundsTab />}
              {tab === 'payouts' && <PayoutsTab />}
              {tab === 'lock' && <LockTab />}
              {tab === 'reports' && <ReportQueue courseId={null} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AdminPage() {
  return (
    <RequireLogin>
      <AdminInner />
    </RequireLogin>
  );
}
