import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { ButtonLink } from '../components/ui/Button';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { useAuth } from '../features/auth/AuthContext';
import { CommunityLogo } from '../features/settings/ui';
import { isOwner, lineText, roleText } from '../features/settings/communities/format';
import { sortCommunities, useMyCommunities } from '../features/settings/communities/queries';

const ACTIVE = 'myCommunities';

const OUTLINE_BTN =
  'inline-flex h-[52px] items-center justify-center gap-2.5 rounded-2xl border border-[rgba(120,60,20,.12)] bg-white px-7 text-base font-bold text-stone-900 no-underline hover:border-[#fdba74]';

/** Minh họa cộng đồng (nhỏ, nằm trên tiêu đề). */
function CommunityArt() {
  return <img src="/images/background_comunity.png" alt="" className="mx-auto mb-4 h-auto w-full max-w-[460px]" />;
}

function EmptyState({ title, content, children }: { title: React.ReactNode; content: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto flex max-w-[640px] flex-col items-center px-4 pt-8 pb-24 text-center">
      <CommunityArt />
      <h1 className="m-0 text-[clamp(30px,4.4vw,52px)] leading-[1.15] font-extrabold tracking-[-1.5px] text-balance">{title}</h1>
      <p className="mt-4 mb-8 max-w-[520px] text-[clamp(15px,1.4vw,18px)] leading-[1.6] text-stone-600 text-pretty">{content}</p>
      <div className="flex flex-wrap items-center justify-center gap-3.5">{children}</div>
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
        <ButtonLink to="/login" state={{ from: location.pathname }} className="h-[52px] gap-2.5 rounded-2xl px-8 text-base font-bold">
          <MaterialIcon name="login" size={20} color="#fff" />
          {t('myCommunities.login')}
        </ButtonLink>
        <Link to="/" className={OUTLINE_BTN}>
          <MaterialIcon name="explore" size={20} />
          {t('myCommunities.explore')}
        </Link>
        <div className="mt-2 w-full text-[15px] text-stone-500">
          {t('myCommunities.noAccount')}{' '}
          <Link to="/register" className="font-bold">
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
        <ButtonLink to="/" className="h-[52px] gap-2.5 rounded-2xl px-8 text-base font-bold">
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
                {c.pinned && <MaterialIcon name="keep" size={18} filled color="#f26a1b" />}
              </div>
              <div className="text-sm leading-normal text-stone-500">{lineText(c)}</div>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(800px_600px_at_5%_95%,rgba(255,160,100,.22),transparent_70%),radial-gradient(700px_500px_at_98%_55%,rgba(255,200,160,.25),transparent_70%),#fff]">
      <Header active={ACTIVE} />
      {body}
    </div>
  );
}
