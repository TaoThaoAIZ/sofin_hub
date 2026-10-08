import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { ButtonLink } from '../components/ui/Button';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { ApiError, resolveApiPath } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';
import { RequireAuth } from '../features/auth/RequireAuth';
import { Avatar } from '../features/account/components/Avatar';
import { usePublicProfile } from '../features/account/queries';
import { roleLabel, formatDate } from '../features/account/roles';

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
  const { t } = useTranslation('account');
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { data: profile, isPending, error } = usePublicProfile(id);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="mx-auto flex w-full max-w-[860px] flex-col gap-6 px-4 py-8 md:py-12">
        {isPending && <p className="py-16 text-center text-stone-500">{t('profile.loading')}</p>}

        {error && (
          <div className="grid place-items-center gap-3 py-16 text-center">
            <p className="m-0 text-5xl font-extrabold text-brand">{error instanceof ApiError && error.status === 404 ? '404' : t('profile.error')}</p>
            <p className="m-0 text-stone-600">
              {error instanceof ApiError && error.status === 404
                ? t('profile.notFound')
                : error instanceof ApiError
                  ? error.message
                  : t('profile.loadFail')}
            </p>
            <ButtonLink to="/" className="h-10 rounded-[14px] px-[18px] text-sm font-semibold">
              {t('profile.home')}
            </ButtonLink>
          </div>
        )}

        {profile && (
          <>
            {profile.coverUrl && <img src={resolveApiPath(profile.coverUrl)} alt="" className="mb-3 h-40 w-full rounded-3xl object-cover sm:h-52" />}
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
                    {t('profile.joined', { date: formatDate(profile.joinedAt) })}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <div className="glass-chip rounded-2xl px-4 py-2 text-center">
                  <div className="text-2xl font-extrabold text-brand">{profile.totalPoints}</div>
                  <div className="text-xs text-stone-500">{t('profile.totalPoints')}</div>
                </div>
                {user?.id === profile.id && (
                  <ButtonLink to="/settings" className="h-10 rounded-[14px] px-4 text-sm font-semibold">
                    {t('profile.edit')}
                  </ButtonLink>
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold">{t('profile.communities')}</h2>
              {profile.communities.length === 0 ? (
                <p className="glass rounded-2xl p-5 text-stone-500">{t('profile.noCommunities')}</p>
              ) : (
                <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
                  {profile.communities.map((c) => (
                    <li key={c.course.id}>
                      <Link to={`/communities/${c.course.id}/community`} className="glass flex items-center gap-3 rounded-2xl p-3 text-stone-900 hover:brightness-[1.03]">
                        <img src={c.course.thumbnail} alt="" className="size-14 flex-none rounded-xl object-cover" />
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{c.course.title}</div>
                          <div className="text-[13px] text-stone-500">
                            {t('profile.roleSince', { role: roleLabel(c.role), date: formatDate(c.joinedAt) })}
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
