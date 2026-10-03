import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError } from '../../../lib/api';
import { ModalShell, useMenu, useToast } from '../../admin/components/overlay';
import type { MyCommunity } from '../communities/api';
import { DraftsSection, PendingSection, PointsSection } from '../communities/ExtraSections';
import { isManager, isOwner, lineText, roleText } from '../communities/format';
import { useLeaveCommunity, useMyCommunities, usePatchCommunity, useReorderCommunities } from '../communities/queries';
import { CommunityLogo, SCard, SHead, Toggle } from '../ui';

type Filter = 'all' | 'own' | 'mem';

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Có lỗi xảy ra, vui lòng thử lại.');
const SIDE_BTN =
  'inline-flex h-11 items-center gap-2 rounded-xl border-[1.5px] border-[#e7e0da] bg-white px-[18px] text-sm font-bold whitespace-nowrap text-stone-900 no-underline hover:border-[#fdba74]';

export function CommunitiesTab() {
  const q = useMyCommunities();
  const toast = useToast();
  const navigate = useNavigate();
  const patch = usePatchCommunity();
  const reorder = useReorderCommunities();
  const leave = useLeaveCommunity();
  const { openMenu, menuEl } = useMenu();
  const [filter, setFilter] = useState<Filter>('all');
  const [dragId, setDragId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<MyCommunity | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const all = q.data ?? [];
  const counts = { all: all.length, own: all.filter(isManager).length, mem: all.filter((c) => !isManager(c)).length };
  const shown = all.filter((c) => filter === 'all' || (filter === 'own') === isManager(c));

  const doPatch = (c: MyCommunity, body: { sidebarVisible?: boolean; pinned?: boolean }, ok: string) =>
    patch.mutate({ id: c.id, body }, { onSuccess: () => toast.success(ok), onError: (e) => toast.error(errMsg(e)) });

  const onDrop = (target: MyCommunity) => {
    const from = dragId;
    setDragId(null);
    if (!from || from === target.id) return;
    const ids = all.map((c) => c.id).filter((id) => id !== from);
    ids.splice(ids.indexOf(target.id), 0, from);
    reorder.mutate(ids, { onSuccess: () => toast.success('Đã cập nhật thứ tự'), onError: (e) => toast.error(errMsg(e)) });
  };

  const onMenu = (e: React.MouseEvent<HTMLElement>, c: MyCommunity) =>
    openMenu(
      e,
      [
        { icon: 'keep', label: c.pinned ? 'Bỏ ghim' : 'Ghim lên đầu thanh bên', onClick: () => doPatch(c, { pinned: !c.pinned }, c.pinned ? 'Đã bỏ ghim' : `Đã ghim ${c.title}`) },
        { icon: 'notifications', label: 'Tùy chỉnh thông báo', onClick: () => navigate('/settings/thong-bao') },
        { icon: 'credit_card', label: 'Quản lý gói thành viên', onClick: () => navigate('/settings/thanh-toan') },
        { icon: 'delete', label: 'Rời cộng đồng', danger: true, onClick: () => { setLeaveError(null); setLeaving(c); } },
      ],
      undefined,
      260,
    );

  const confirmLeave = () => {
    if (!leaving) return;
    if (isOwner(leaving)) return setLeaving(null); // chủ sở hữu: chỉ cần "Đã hiểu"
    leave.mutate(leaving.id, {
      onSuccess: () => {
        toast.success(`Đã rời ${leaving.title}`);
        setLeaving(null);
      },
      onError: (e) => setLeaveError(errMsg(e)),
    });
  };

  const tabs: readonly [Filter, string][] = [
    ['all', `Tất cả · ${counts.all}`],
    ['own', `Tôi quản lý · ${counts.own}`],
    ['mem', `Thành viên · ${counts.mem}`],
  ];

  return (
    <main className="grid min-w-0 grid-cols-1 items-start gap-[18px] min-[1180px]:grid-cols-[minmax(0,1.75fr)_minmax(280px,1fr)]">
      <SCard>
        <SHead
          size="lg"
          icon="groups"
          title="Cộng đồng đã tham gia"
          sub="Kéo để sắp xếp thứ tự trên thanh bên trái."
          className="border-b border-[#f1ebe6] pb-4"
          action={
            <div role="tablist" className="flex rounded-[14px] bg-[#f5f2ef] p-1">
              {tabs.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  onClick={() => setFilter(id)}
                  className={`flex h-10 items-center rounded-[11px] border-[1.5px] px-4 text-sm font-semibold whitespace-nowrap ${
                    filter === id ? 'border-[#fdba74] bg-white text-brand' : 'border-transparent bg-transparent text-stone-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        />
        {q.isPending && <div className="px-2.5 py-10 text-center text-[14.5px] text-stone-500">Đang tải…</div>}
        {q.isError && <div role="alert" className="px-2.5 py-10 text-center text-[14.5px] text-red-600">{errMsg(q.error)}</div>}
        {shown.map((c) => {
          const owner = isOwner(c);
          return (
            <div
              key={c.id}
              draggable
              onDragStart={() => setDragId(c.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(c);
              }}
              className={`flex items-center gap-4 border-b border-[#f3eee9] py-[18px] ${dragId === c.id ? 'bg-[#fff8f3]' : ''}`}
            >
              <MaterialIcon name="drag_indicator" size={22} color="#c7bfb8" className="cursor-grab" />
              <CommunityLogo name={c.title} seed={c.id} size={60} src={c.logoUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[16.5px] font-bold">{c.title}</span>
                  <span className={`rounded-lg px-2.5 py-1 text-[12.5px] font-bold whitespace-nowrap ${owner ? 'bg-[#1e293b] text-white' : 'bg-[#dcfce7] text-[#15803d]'}`}>{roleText(c)}</span>
                  {c.pinned && <MaterialIcon name="keep" size={18} filled color="#f26a1b" />}
                </div>
                <div className="mt-1 text-sm leading-normal text-stone-500">{lineText(c)}</div>
              </div>
              <div className="flex flex-none items-center gap-3">
                {owner ? (
                  <Link to={`/communities/${c.id}/community/cai-dat`} title="Cài đặt cộng đồng" className={SIDE_BTN}>
                    <MaterialIcon name="settings" size={20} />
                    <span className="max-[1180px]:hidden">Cài đặt cộng đồng</span>
                  </Link>
                ) : (
                  <Link to={`/communities/${c.id}/community`} className={SIDE_BTN}>
                    Mở
                  </Link>
                )}
                <Toggle
                  label={`Hiện ${c.title} trên thanh bên`}
                  on={c.sidebarVisible}
                  onChange={(v) => doPatch(c, { sidebarVisible: v }, `${v ? 'Đã hiện' : 'Đã ẩn'} ${c.title} trên thanh bên`)}
                />
                <button type="button" aria-label={`Tùy chọn ${c.title}`} onClick={(e) => onMenu(e, c)} className="grid size-11 flex-none cursor-pointer place-items-center rounded-xl border-[1.5px] border-[#e7e0da] bg-white">
                  <MaterialIcon name="more_horiz" size={22} />
                </button>
              </div>
            </div>
          );
        })}
        {q.data && shown.length === 0 && <div className="px-2.5 py-10 text-center text-[14.5px] text-stone-500">Chưa có cộng đồng nào trong mục này.</div>}
      </SCard>

      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className="relative overflow-hidden rounded-[20px] border border-[#fde3cf] bg-gradient-to-br from-[#fff4ea] to-[#ffe3cd] p-6">
          <span className="mx-auto mb-4 grid size-[84px] place-items-center rounded-full bg-white shadow-[0_10px_24px_rgba(242,106,27,.18)]">
            <MaterialIcon name="groups" size={44} filled color="#f26a1b" />
          </span>
          <div className="text-xl leading-[1.35] font-extrabold">
            Có điều muốn dạy?
            <br />
            Mở cộng đồng của riêng bạn.
          </div>
          <div className="mt-2 text-[14.5px] leading-[1.55] text-stone-600">Dùng thử 14 ngày, thiết lập trong khoảng 10 phút.</div>
          <Link
            to="/communities/new"
            className="mt-[18px] flex h-[50px] items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#ff8f45] to-[#f26a1b] text-[15px] font-bold text-white no-underline shadow-[0_10px_24px_rgba(242,106,27,.3)]"
          >
            Tạo cộng đồng
            <MaterialIcon name="arrow_forward" size={19} />
          </Link>
        </section>
        <SCard>
          <SHead size="lg" icon="search" title="Tìm thêm cộng đồng" sub="Gợi ý dựa trên các chủ đề bạn đang quan tâm." />
          <Link to="/" className="mt-[18px] grid h-[50px] place-items-center rounded-xl border-[1.5px] border-[#e7e0da] text-[15px] font-bold text-stone-900 no-underline hover:border-[#fdba74]">
            Mở trang Khám phá
          </Link>
        </SCard>
      </div>

      <PendingSection />
      <DraftsSection />
      <PointsSection communities={all} />

      {menuEl}
      {leaving && (
        <ModalShell
          icon="logout"
          danger={!isOwner(leaving)}
          title={`Rời ${leaving.title}?`}
          body={
            isOwner(leaving)
              ? 'Bạn là chủ sở hữu. Hãy chuyển quyền trước khi rời.'
              : 'Bạn sẽ mất quyền truy cập nội dung và cấp độ hiện tại. Gói trả phí vẫn dùng được tới ngày gia hạn.'
          }
          cta={isOwner(leaving) ? 'Đã hiểu' : 'Rời cộng đồng'}
          pending={leave.isPending}
          error={leaveError}
          onConfirm={confirmLeave}
          onClose={() => setLeaving(null)}
        />
      )}
    </main>
  );
}
