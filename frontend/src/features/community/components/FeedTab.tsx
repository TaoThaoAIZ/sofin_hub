import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useAuth } from '../../auth/AuthContext';
import { useCommunityDetail } from '../../courses/queries';
import { usePost, usePostsFeed } from '../queries';
import { categoryLabel, POST_CATEGORIES, type PostCategory } from '../types';
import { CommunityRightSidebar } from './CommunityRightSidebar';
import { errText, ErrorNote, ghostBtn, ToastHost } from './contentUi';
import { CATEGORY_META, PostCard } from './PostCard';
import { PostComposer } from './PostComposer';

// Tên icon + màu chuyên mục: xem CATEGORY_META trong PostCard.tsx (lấy từ file thiết kế gốc).
const FILTERS: { key: 'all' | 'trending' | PostCategory; icon?: string; color?: string }[] = [
  { key: 'all' },
  { key: 'trending', icon: 'local_fire_department', color: '#f26a1b' },
  ...POST_CATEGORIES.map((c) => ({ key: c, icon: CATEGORY_META[c].icon, color: CATEGORY_META[c].color })),
];

const WELCOME_ACTIONS = [
  { key: 'video', icon: 'play_arrow', comingSoon: true },
  { key: 'popular', icon: 'description', comingSoon: false },
  { key: 'app', icon: 'groups', comingSoon: true },
] as const;

export function FeedTab() {
  const { t } = useTranslation('community');
  const { id: courseId = '' } = useParams();
  const { user } = useAuth();
  const { data: course } = useCommunityDetail(courseId);
  const [params, setParams] = useSearchParams();
  const tag = params.get('tag') ?? undefined;
  const sharedPostId = params.get('post');
  const [category, setCategory] = useState<PostCategory | undefined>(undefined);
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');
  const viewerRole = course?.viewerRole;

  const posts = usePostsFeed(courseId, { category, sort, tag });
  const list = useMemo(() => posts.data?.pages.flatMap((pg) => pg.data) ?? [], [posts.data]);
  const total = posts.data?.pages[0]?.meta.total ?? 0;

  // Mở bài cụ thể qua ?post=:id (link chia sẻ): nếu chưa nằm trong các trang đã tải thì gọi GET /posts/:id.
  const inList = !!sharedPostId && list.some((p) => p.id === sharedPostId);
  const shared = usePost(sharedPostId && posts.isSuccess && !inList ? sharedPostId : null);
  const sharedRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!sharedPostId || scrolledFor.current === sharedPostId) return;
    const el = document.getElementById(`post-${sharedPostId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      scrolledFor.current = sharedPostId;
    }
  }, [sharedPostId, list, shared.data]);

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-6 max-[1180px]:grid-cols-1">
      <ToastHost />
      <div className="flex flex-col gap-4">
        <PostComposer courseId={courseId} />

        <div className="relative min-h-[210px] overflow-hidden rounded-[24px] border border-brand/15 bg-gradient-to-br from-[#fff6ef] to-[#ffe6d4] p-6">
          <img
            src="/images/community-welcome-art.webp"
            alt=""
            className="pointer-events-none absolute inset-0 size-full object-cover"
          />
          <div className="relative z-10">
            <h2 className="m-0 text-[26px] font-extrabold tracking-tight">{t('feed.welcome', { name: user?.firstName ?? t('feed.welcomeFallbackName') })}</h2>
            <p className="mt-2 max-w-[520px] text-[14.5px] text-stone-700">
              {t('feed.welcomeSub', { title: course?.title ?? '' })}
            </p>
            <div className="mt-[22px] flex max-w-[800px] flex-wrap gap-3.5">
              {WELCOME_ACTIONS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  disabled={a.comingSoon}
                  title={a.comingSoon ? t('feed.comingSoon') : undefined}
                  onClick={a.key === 'popular' ? () => setSort('popular') : undefined}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white/90 px-4 py-3.5 text-left shadow-[0_6px_18px_rgba(120,60,20,.08)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <MaterialIcon name={a.icon} size={28} filled color="#f26a1b" className="flex-none" />
                  <div className="min-w-0">
                    <div className="truncate text-[14.5px] font-bold">{t(`feed.actions.${a.key}.title`)}</div>
                    <div className="mt-[3px] truncate text-xs text-stone-500">{t(`feed.actions.${a.key}.desc`)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = f.key === 'trending' ? sort === 'popular' : sort === 'latest' && (f.key === 'all' ? !category : category === f.key);
            return (
              <button
                key={f.key}
                onClick={() => {
                  if (f.key === 'trending') {
                    setSort('popular');
                    setCategory(undefined);
                  } else {
                    setSort('latest');
                    setCategory(f.key === 'all' ? undefined : f.key);
                  }
                }}
                className={`flex h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold whitespace-nowrap ${
                  active ? 'bg-brand text-white' : 'glass-chip text-stone-900'
                }`}
              >
                {f.icon && <MaterialIcon name={f.icon} size={17} filled={f.key === 'trending'} color={active ? '#fff' : f.color} />}
                {f.key === 'all' ? t('feed.all') : f.key === 'trending' ? t('feed.trending') : categoryLabel(f.key)}
              </button>
            );
          })}
        </div>

        {tag && (
          <div className="flex items-center gap-2 text-[13.5px]">
            <span className="text-stone-500">{t('feed.filteringByTag')}</span>
            <span className="flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1 font-semibold text-brand">
              #{tag}
              <button type="button" aria-label={t('feed.clearTag')} onClick={() => setParam('tag')}>
                <MaterialIcon name="close" size={15} color="#f26a1b" />
              </button>
            </span>
          </div>
        )}

        {sharedPostId && !inList && (
          <div ref={sharedRef} className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[12.5px] text-stone-500">
              <span>{t('feed.sharedWithYou')}</span>
              <button type="button" onClick={() => setParam('post')} className="font-semibold text-brand">
                {t('feed.close')}
              </button>
            </div>
            {shared.isPending && posts.isSuccess && <p className="glass rounded-2xl py-6 text-center text-sm text-stone-400">{t('feed.loadingPost')}</p>}
            {shared.isError && <ErrorNote message={t('feed.sharedError')} />}
            {shared.data && <PostCard courseId={courseId} post={shared.data} viewerRole={viewerRole} highlighted onTagClick={(tg) => setParam('tag', tg)} />}
          </div>
        )}

        {posts.isPending && <p className="py-10 text-center text-stone-400">{t('feed.loadingFeed')}</p>}
        {posts.isError && <ErrorNote message={errText(posts.error, t('feed.loadFeedFailed'))} />}
        {posts.isSuccess && list.length === 0 && (
          <p className="glass rounded-2xl py-10 text-center text-stone-500">
            {tag ? t('feed.emptyTag', { tag }) : t('feed.empty')}
          </p>
        )}
        {list.map((p) => (
          <PostCard key={p.id} courseId={courseId} post={p} viewerRole={viewerRole} highlighted={p.id === sharedPostId} onTagClick={(tg) => setParam('tag', tg)} />
        ))}
        {posts.hasNextPage && (
          <button type="button" onClick={() => posts.fetchNextPage()} disabled={posts.isFetchingNextPage} className={`${ghostBtn} self-center`}>
            {posts.isFetchingNextPage ? t('common.loading') : t('feed.loadMore', { loaded: list.length, total })}
          </button>
        )}
        {posts.isFetchNextPageError && <ErrorNote message={errText(posts.error, t('feed.loadMoreFailed'))} />}
      </div>

      {course && <CommunityRightSidebar course={course} />}
    </div>
  );
}
