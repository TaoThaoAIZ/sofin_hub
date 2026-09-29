import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { useAuth } from '../features/auth/AuthContext';
import { RequireAuth } from '../features/auth/RequireAuth';
import { DeleteAccountPanel } from '../features/account/components/DeleteAccountPanel';
import { PasswordForm } from '../features/account/components/PasswordForm';
import { ProfileForm } from '../features/account/components/ProfileForm';
import { SessionsPanel } from '../features/account/components/SessionsPanel';
import { VerifyBanner } from '../features/account/components/VerifyBanner';

const TABS = [
  { key: 'profile', label: 'Hồ sơ' },
  { key: 'password', label: 'Mật khẩu' },
  { key: 'sessions', label: 'Phiên đăng nhập' },
  { key: 'delete', label: 'Xóa tài khoản' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsContent />
    </RequireAuth>
  );
}

function SettingsContent() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>('profile');

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="mx-auto flex w-full max-w-[860px] flex-col gap-6 px-4 py-8 md:py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="m-0 text-[clamp(26px,3vw,36px)] font-extrabold tracking-[-1px]">Cài đặt tài khoản</h1>
          {user && (
            <Link to={`/users/${user.id}`} className="text-sm font-semibold">
              Xem hồ sơ công khai
            </Link>
          )}
        </div>

        <VerifyBanner />

        <div role="tablist" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                tab === t.key ? 'bg-brand-gradient text-white' : 'glass-chip text-stone-700 hover:text-brand'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <section className="glass rounded-3xl p-5 sm:p-8">
          {tab === 'profile' && <ProfileForm />}
          {tab === 'password' && <PasswordForm />}
          {tab === 'sessions' && <SessionsPanel />}
          {tab === 'delete' && <DeleteAccountPanel />}
        </section>
      </main>
      <Footer />
    </div>
  );
}
