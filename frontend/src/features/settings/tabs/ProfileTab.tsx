import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError } from '../../../lib/api';
import { useUpdateProfile, usePublicProfile } from '../../account/queries';
import { useAuth } from '../../auth/AuthContext';
import { useUpload } from '../../uploads/useUpload';
import { useToast } from '../../admin/components/overlay';
import { BARE_INPUT, IconInput, OUTLINE_BTN, PRIMARY_BTN, Toggle } from '../ui';
import {
  BIO_MAX,
  diffToPatch,
  formFromUser,
  handleFormatError,
  initialsOf,
  sanitizeHandle,
  validateForm,
  type ProfileForm,
} from '../profile/form';
import { ProfilePreview } from '../profile/ProfilePreview';
import { useDebounced, useHandleAvailability } from '../profile/queries';

const SECTION = 'rounded-[20px] border border-[rgba(120,60,20,.07)] bg-white px-7 pt-6 pb-[26px]';
const LABEL = 'flex flex-col gap-2 text-[14.5px] font-bold';

/** Tab "Hồ sơ" (thiết kế "Cai dat ho so"): form bên trái, thẻ xem trước bên phải (≥1240px; hẹp hơn thì nằm dưới form). */
export function ProfileTab() {
  const { user } = useAuth();
  const toast = useToast();
  const update = useUpdateProfile();
  const { upload, uploading } = useUpload();
  const stats = usePublicProfile(user?.id ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  // `saved` = bản đang lưu ở server; `form` = bản đang sửa. Đổi tài khoản/lưu xong thì form đồng bộ lại theo saved.
  const saved = useMemo(() => (user ? formFromUser(user) : null), [user]);
  const [form, setForm] = useState<ProfileForm | null>(saved);
  const [dragOver, setDragOver] = useState(false);
  useEffect(() => {
    if (saved) setForm((f) => f ?? saved);
  }, [saved]);

  const handle = form?.handle ?? '';
  const fmtErr = handleFormatError(handle);
  const changed = !!saved && handle !== saved.handle && handle !== '';
  const debounced = useDebounced(handle);
  const checking = useHandleAvailability(debounced, changed && !fmtErr && debounced === handle);

  if (!user || !saved || !form) return <main className="min-w-0" />;

  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  // Trạng thái ô đường dẫn: [ok?, text, đang kiểm tra?]
  let hOk = true;
  let hText = '';
  let hPending = false;
  if (fmtErr) [hOk, hText] = [false, fmtErr];
  else if (changed) {
    if (debounced !== handle || checking.isFetching) hPending = true;
    else if (checking.data && !checking.data.available) [hOk, hText] = [false, checking.data.reason === 'reserved' ? 'Tên được giữ chỗ' : checking.data.reason === 'invalid' ? 'Không hợp lệ' : 'Đã có người dùng'];
    else if (!checking.data) hPending = true;
  }

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    try {
      const up = await upload(file, { purpose: 'avatar' });
      set('avatarUrl', up.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tải được ảnh');
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void pickAvatar(e.dataTransfer.files[0]);
  };

  const cancel = () => {
    setForm(saved);
    toast.success(dirty ? 'Đã hủy các thay đổi' : 'Không có thay đổi nào');
  };

  const save = async () => {
    if (!dirty) return toast.success('Không có thay đổi nào');
    const invalid = validateForm(form);
    if (invalid) return toast.error(invalid);
    if (!hOk) return toast.error('Đường dẫn hồ sơ chưa hợp lệ');
    if (hPending) return toast.error('Đang kiểm tra đường dẫn hồ sơ, vui lòng đợi giây lát');
    try {
      const next = await update.mutateAsync(diffToPatch(saved, form));
      setForm(formFromUser(next));
      toast.success('Đã lưu thay đổi');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không lưu được, vui lòng thử lại');
    }
  };

  const links = [
    { key: 'website', label: 'Website', icon: 'language', color: '#57534e', ph: 'https://' },
    { key: 'instagram', label: 'Instagram', icon: 'photo_camera', color: '#e1306c', ph: '@tên_tài_khoản' },
    { key: 'youtube', label: 'YouTube', icon: 'smart_display', color: '#57534e', ph: 'Link kênh' },
    { key: 'city', label: 'Thành phố', icon: 'location_on', color: '#57534e', ph: 'Thành phố của bạn' },
  ] as const;

  return (
    <>
      <main className="flex min-w-0 flex-col gap-[18px]">
        <section className={SECTION}>
          <div>
            <div className="text-xl font-extrabold">Thông tin công khai</div>
            <div className="mt-[3px] text-sm text-stone-500">Mọi thành viên ở các cộng đồng bạn tham gia đều thấy phần này.</div>
          </div>

          <div className="mt-[22px] flex flex-wrap items-center gap-[26px]">
            <div
              className="relative size-28 flex-none"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <div
                className={`grid size-28 place-items-center overflow-hidden rounded-full bg-[#2f4fa8] text-[34px] font-extrabold text-white ${dragOver ? 'ring-4 ring-[#fdba74]' : ''}`}
              >
                {form.avatarUrl ? <img src={form.avatarUrl} alt="Ảnh đại diện" className="size-full object-cover" /> : initialsOf(form.first, form.last)}
              </div>
              <button
                type="button"
                aria-label="Đổi ảnh đại diện"
                onClick={() => fileRef.current?.click()}
                className="absolute right-0 bottom-1 grid size-8 cursor-pointer place-items-center rounded-full border border-[#ece5df] bg-white p-0 shadow-[0_2px_6px_rgba(0,0,0,.1)]"
              >
                <MaterialIcon name="photo_camera" size={18} />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={(e) => {
                  void pickAvatar(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
            <div className="min-w-[240px] flex-1">
              <div className="flex flex-wrap items-center gap-[18px]">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={OUTLINE_BTN}>
                  <MaterialIcon name="account_circle" size={20} />
                  {uploading ? 'Đang tải ảnh…' : 'Đổi ảnh đại diện'}
                </button>
                <button
                  type="button"
                  disabled={!form.avatarUrl}
                  onClick={() => {
                    set('avatarUrl', '');
                    toast.success('Đã xóa ảnh đại diện · nhớ bấm Lưu thay đổi');
                  }}
                  className="flex items-center gap-1.5 border-0 bg-transparent p-0 text-sm font-semibold text-[#dc2626] disabled:opacity-40"
                >
                  <MaterialIcon name="delete" size={20} />
                  Xóa ảnh
                </button>
              </div>
              <div className="mt-3 text-[13.5px] text-stone-500">
                {form.avatarUrl ? 'Kéo thả ảnh vào khung tròn để thay ảnh.' : 'Nhiều cộng đồng yêu cầu ảnh thật khi duyệt thành viên.'}
              </div>
            </div>
          </div>

          <div className="mt-[22px] grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            <label className={LABEL}>
              Họ
              <IconInput icon="person">
                <input value={form.last} onChange={(e) => set('last', e.target.value)} maxLength={80} className={BARE_INPUT} />
              </IconInput>
            </label>
            <label className={LABEL}>
              Tên
              <IconInput icon="person">
                <input value={form.first} onChange={(e) => set('first', e.target.value)} maxLength={80} className={BARE_INPUT} />
              </IconInput>
            </label>
          </div>

          <div className="mt-[18px] text-[14.5px] font-bold">Đường dẫn hồ sơ</div>
          <div className="mt-2 flex h-[50px] overflow-hidden rounded-xl border-[1.5px] border-[#e7e0da] focus-within:border-[#fdba74]">
            <span className="flex flex-none items-center border-r-[1.5px] border-[#e7e0da] bg-[#f5f2ef] px-4 text-[15px] text-stone-600">sofinhub.com/@</span>
            <input
              value={form.handle}
              onChange={(e) => set('handle', sanitizeHandle(e.target.value))}
              aria-label="Đường dẫn hồ sơ"
              className="min-w-0 flex-1 border-0 px-3.5 text-[15px] font-medium outline-0"
            />
            {(form.handle || fmtErr) && (
              <span className={`flex flex-none items-center gap-1.5 px-3.5 text-[13px] font-semibold ${hOk && !hPending ? 'text-[#16a34a]' : hPending ? 'text-stone-500' : 'text-[#dc2626]'}`}>
                <MaterialIcon name={hPending ? 'sync' : hOk ? 'check_circle' : 'error'} size={22} filled />
                {hPending ? 'Đang kiểm tra…' : hText}
              </span>
            )}
          </div>

          <div className="mt-[18px] text-[14.5px] font-bold">Giới thiệu</div>
          <div className="mt-2 flex gap-3 rounded-xl border-[1.5px] border-[#e7e0da] p-3.5 focus-within:border-[#fdba74]">
            <span className="mt-0.5">
              <MaterialIcon name="edit" size={20} color="#78716c" />
            </span>
            <textarea
              value={form.bio}
              onChange={(e) => set('bio', e.target.value)}
              maxLength={BIO_MAX}
              placeholder="Vài dòng về bạn"
              aria-label="Giới thiệu"
              className="h-[62px] min-w-0 flex-1 resize-none border-0 text-[15px] leading-[1.6] font-medium outline-0 placeholder:text-stone-400"
            />
          </div>
          <div className="mt-2 text-right text-[13px] text-stone-500">
            {form.bio.length}/{BIO_MAX}
          </div>
        </section>

        <section className={SECTION}>
          <div className="flex items-start gap-4">
            <span className="grid size-[46px] flex-none place-items-center rounded-full bg-[#fff1e6]">
              <MaterialIcon name="link" size={24} weight={600} color="#f26a1b" />
            </span>
            <div>
              <div className="text-xl font-extrabold">Liên kết &amp; vị trí</div>
              <div className="mt-[3px] text-sm text-stone-500">Hiển dưới dạng biểu tượng trên hồ sơ của bạn.</div>
            </div>
          </div>
          <div className="mt-5 grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            {links.map((l) => (
              <label key={l.key} className={LABEL}>
                {l.label}
                <IconInput icon={l.icon} iconColor={l.color} height={48}>
                  <input value={form[l.key]} onChange={(e) => set(l.key, e.target.value)} placeholder={l.ph} maxLength={300} className={BARE_INPUT} />
                </IconInput>
              </label>
            ))}
          </div>
          <div className="mt-[22px] flex items-center gap-4">
            <div className="flex-1">
              <div className="text-[15px] font-bold">Hiện vị trí của tôi trên bản đồ thành viên</div>
              <div className="mt-[3px] text-[13.5px] text-stone-500">Giúp các thành viên khác dễ dàng tìm thấy bạn trong khu vực.</div>
            </div>
            <Toggle on={form.showOnMap} onChange={(v) => set('showOnMap', v)} label="Hiện vị trí trên bản đồ thành viên" />
          </div>
        </section>
      </main>

      <aside className="self-start rounded-[20px] border border-[rgba(120,60,20,.07)] bg-white p-[18px] min-[900px]:col-start-2 min-[900px]:row-start-2 min-[1240px]:sticky min-[1240px]:top-[88px] min-[1240px]:col-start-3 min-[1240px]:row-start-1">
        <div className="mb-3.5 text-[15px] font-bold">Người khác thấy bạn như thế này</div>
        <ProfilePreview
          form={form}
          stats={{ level: stats.data?.level, points: stats.data?.totalPoints, communities: stats.data?.communityCount, joinedAt: user.createdAt }}
        />
        <div className="mt-4 grid grid-cols-[1fr_1.4fr] gap-3">
          <button type="button" onClick={cancel} disabled={update.isPending} className="h-[52px] rounded-xl border-[1.5px] border-[#e7e0da] bg-white text-[15px] font-bold disabled:opacity-50">
            Hủy
          </button>
          <button
            type="button"
            onClick={save}
            disabled={update.isPending}
            className={`${PRIMARY_BTN} h-[52px] text-[15.5px] ${dirty ? '' : 'opacity-85'}`}
          >
            {update.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </div>
      </aside>
    </>
  );
}
