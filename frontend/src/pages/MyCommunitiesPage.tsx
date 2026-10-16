import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { ThemedImg } from '../components/ui/ThemedImg';
import { ButtonLink } from '../components/ui/Button';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { useAuth } from '../features/auth/AuthContext';
import { CommunityLogo } from '../features/settings/ui';
import { isOwner, lineText, roleText } from '../features/settings/communities/format';
import { sortCommunities, useMyCommunities } from '../features/settings/communities/queries';

const ACTIVE = 'myCommunities';

/** Nút phụ (Figma "Explore communities action"): cao 47, bo 15; sáng = trắng viền #eee1d9; tối = xám sáng .16. */
const OUTLINE_BTN =
  'inline-flex h-[47px] items-center justify-center gap-2.5 rounded-[15px] border border-[#eee1d9] bg-white px-7 text-[15px] font-bold text-[#1e1c1a] no-underline hover:border-[#fdba74] dark:border-transparent dark:bg-[rgba(232,232,232,.16)] dark:text-[#e8e8e8]';
/** Nút chính (Figma "Sign in action"): cam #ff6717, cao 47, bo 15. */
const PRIMARY_BTN = 'h-[47px] gap-2.5 rounded-[15px] bg-[#ff6717] px-8 text-[15px] font-bold shadow-[0_4px_10px_rgba(229,120,41,0.15)]';

function EmptyState({ title, content, children }: { title: React.ReactNode; content: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto flex max-w-[1000px] flex-col items-center px-4 pt-[clamp(24px,3.5vw,64px)] pb-[clamp(40px,5vw,90px)] text-center">
      <ThemedImg name="guest_art" className="mx-auto h-auto w-full max-w-[482px]" />
      <h1 className="m-0 pt-2.5 text-[clamp(30px,2.45vw,44px)] leading-[1.32] font-extrabold text-[#1e1c1a] text-balance dark:text-white">{title}</h1>
      <p className="mt-3 mb-0 max-w-[620px] text-base leading-[26px] text-[#696460] text-pretty dark:text-[#bababa]">{content}</p>
      <div className="flex flex-wrap items-center justify-center gap-[13px] pt-[29px]">{children}</div>
    </section>
  );
}

export function MyCommunitiesPage() {
  const { t } = useTranslation('misc');
  const { status } = useAuth();
  const location = useLocation();
  const authed = status === 'authenticated';
  const q = useMyCommunities();
  const list = sortCommunities(q.data ?? []);

  let body: React.ReactNode;
  if (status === 'loading' || (authed && q.isPending)) {
    body = <p className="py-24 text-center text-stone-500">{t('myCommunities.loading')}</p>;
  } else if (!authed) {
    body = (
      <EmptyState
        title={
          <>
            {t('myCommunities.guestTitle1')}<span className="text-brand">{t('myCommunities.guestTitleBrand')}</span>{t('myCommunities.guestTitle2')}
          </>
        }
        content={t('myCommunities.guestContent')}
      >
        <ButtonLink to="/login" state={{ from: location.pathname }} className={PRIMARY_BTN}>
          <MaterialIcon name="login" size={20} color="#fff" />
          {t('myCommunities.login')}
        </ButtonLink>
        <Link to="/" className={OUTLINE_BTN}>
          <MaterialIcon name="explore" size={20} />
          {t('myCommunities.explore')}
        </Link>
        <div className="mt-5 w-full text-[13px] leading-5 text-[#837b76] dark:text-[#bababa]">
          {t('myCommunities.noAccount')}{' '}
          <Link to="/register" className="font-bold text-inherit">
            {t('myCommunities.register')}
          </Link>
        </div>
      </EmptyState>
    );
  } else if (q.isError) {
    body = (
      <p role="alert" className="py-24 text-center text-red-600">
        {t('myCommunities.loadError')}
      </p>
    );
  } else if (list.length === 0) {
    body = (
      <EmptyState
        title={t('myCommunities.emptyTitle')}
        content={t('myCommunities.emptyContent')}
      >
        <ButtonLink to="/" className={PRIMARY_BTN}>
          <MaterialIcon name="explore" size={20} color="#fff" />
          {t('myCommunities.explore')}
        </ButtonLink>
      </EmptyState>
    );
  } else {
    body = (
      <section className="mx-auto w-full max-w-[1320px] px-4 pt-10 pb-24 md:px-10">
        <h1 className="m-0 mb-6 text-[clamp(26px,3vw,36px)] font-extrabold tracking-[-1px]">{t('myCommunities.title')}</h1>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <Link
              key={c.id}
              to={`/communities/${c.id}/community`}
              className="glass flex flex-col gap-4 rounded-[20px] p-5 text-inherit no-underline transition-shadow hover:shadow-card-hover"
            >
              <div className="flex items-center gap-4">
                <CommunityLogo name={c.title} seed={c.id} size={60} src={c.logoUrl} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16.5px] font-bold">{c.title}</div>
                  <span
                    className={`mt-1.5 inline-block rounded-lg px-2.5 py-1 text-[12.5px] font-bold whitespace-nowrap ${
                      isOwner(c) ? 'bg-[#1e293b] text-white' : 'bg-[#dcfce7] text-[#15803d]'
                    }`}
                  >
                    {roleText(c)}
                  </span>
                </div>
                {c.pinned && <MaterialIcon name="keep" size={18} filled color="#ff570a" />}
              </div>
              <div className="text-sm leading-normal text-stone-500">{lineText(c)}</div>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="min-h-screen">
      <Header active={ACTIVE} />
      {body}
      <Footer />
    </div>
  );
}
