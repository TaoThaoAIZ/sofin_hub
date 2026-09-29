import { Link, useParams } from 'react-router-dom';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { ButtonLink } from '../components/ui/Button';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { ApiError } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';
import { RequireAuth } from '../features/auth/RequireAuth';
import { Avatar } from '../features/account/components/Avatar';
import { usePublicProfile } from '../features/account/queries';
import { ROLE_LABEL, formatDate } from '../features/account/roles';

export function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}

// Chỉ cho phép http/https để tránh javascript: URL trong href.
const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : null);

function ProfileContent() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { data: profile, isPending, error } = usePublicProfile(id);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="mx-auto flex w-full max-w-[860px] flex-col gap-6 px-4 py-8 md:py-12">
        {isPending && <p className="py-16 text-center text-stone-500">Đang tải hồ sơ…</p>}

        {error && (
          <div className="grid place-items-center gap-3 py-16 text-center">
            <p className="m-0 text-5xl font-extrabold text-brand">{error instanceof ApiError && error.status === 404 ? '404' : 'Lỗi'}</p>
            <p className="m-0 text-stone-600">
              {error instanceof ApiError && error.status === 404
                ? 'Không tìm thấy người dùng này (có thể tài khoản đã bị xóa).'
                : error instanceof ApiError
                  ? error.message
                  : 'Không tải được hồ sơ, vui lòng thử lại.'}
            </p>
            <ButtonLink to="/" className="h-10 rounded-[14px] px-[18px] text-sm font-semibold">
              Về trang chủ
            </ButtonLink>
          </div>
        )}

        {profile && (
          <>
            <section className="glass flex flex-wrap items-start gap-5 rounded-3xl p-5 sm:p-8">
              <Avatar url={profile.avatarUrl} name={profile.name} size={88} />
              <div className="min-w-0 flex-1 basis-[240px]">
                <h1 className="m-0 truncate text-[clamp(24px,3vw,32px)] font-extrabold tracking-[-.5px]">{profile.name}</h1>
                {profile.bio && <p className="mt-2 mb-0 whitespace-pre-line text-[15px] leading-[1.6] text-stone-700">{profile.bio}</p>}
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-stone-600">
                  {profile.location && (
                    <span className="flex items-center gap-1.5">
                      <MaterialIcon name="location_on" size={18} />
                      {profile.location}
                    </span>
                  )}
                  {profile.website && safeUrl(profile.website) && (
                    <a href={safeUrl(profile.website)!} target="_blank" rel="noopener noreferrer nofollow" className="flex min-w-0 items-center gap-1.5 font-medium">
                      <MaterialIcon name="link" size={18} />
                      <span className="truncate">{profile.website.replace(/^https?:\/\//i, '')}</span>
                    </a>
                  )}
                  <span className="flex items-center gap-1.5">
                    <MaterialIcon name="calendar_month" size={18} />
                    Tham gia {formatDate(profile.joinedAt)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <div className="glass-chip rounded-2xl px-4 py-2 text-center">
                  <div className="text-2xl font-extrabold text-brand">{profile.totalPoints}</div>
                  <div className="text-xs text-stone-500">Tổng điểm</div>
                </div>
                {user?.id === profile.id && (
                  <ButtonLink to="/settings" className="h-10 rounded-[14px] px-4 text-sm font-semibold">
                    Chỉnh sửa hồ sơ
                  </ButtonLink>
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold">Cộng đồng đã tham gia</h2>
              {profile.communities.length === 0 ? (
                <p className="glass rounded-2xl p-5 text-stone-500">Chưa tham gia cộng đồng công khai nào.</p>
              ) : (
                <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
                  {profile.communities.map((c) => (
                    <li key={c.course.id}>
                      <Link to={`/courses/${c.course.id}/community`} className="glass flex items-center gap-3 rounded-2xl p-3 text-stone-900 hover:brightness-[1.03]">
                        <img src={c.course.thumbnail} alt="" className="size-14 flex-none rounded-xl object-cover" />
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{c.course.title}</div>
                          <div className="text-[13px] text-stone-500">
                            {ROLE_LABEL[c.role] ?? c.role} · từ {formatDate(c.joinedAt)}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
