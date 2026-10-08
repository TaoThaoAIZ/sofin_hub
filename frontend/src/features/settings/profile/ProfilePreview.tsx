import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { initialsOf, type ProfileForm } from './form';
import { resolveApiPath } from '../../../lib/api';

export interface PreviewStats {
  level?: number;
  points?: number;
  communities?: number;
  joinedAt: string;
}

/** "Tham gia từ tháng M/YYYY" từ ngày tạo tài khoản. */
export function joinedLabel(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : i18n.t('profilePreview.joined', { ns: 'settings', month: d.getMonth() + 1, year: d.getFullYear() });
}

/** Thẻ "Người khác thấy bạn như thế này": dựng từ giá trị ĐANG NHẬP (chưa lưu) + số liệu thật của tài khoản. */
export function ProfilePreview({ form, stats }: { form: ProfileForm; stats: PreviewStats | undefined }) {
  const { t } = useTranslation('settings');
  const fullName = `${form.first.trim()} ${form.last.trim()}`.trim() || t('profilePreview.yourName');
  const links = [
    form.website.trim() && { icon: 'language', color: '#57534e' },
    form.instagram.trim() && { icon: 'photo_camera', color: '#e1306c' },
    form.youtube.trim() && { icon: 'smart_display', color: '#57534e' },
  ].filter(Boolean) as { icon: string; color: string }[];
  const handle = form.handle ? `@${form.handle}` : t('profilePreview.noHandle');
  // Vị trí chỉ hiện với người khác khi bật "hiện trên bản đồ" (BE cũng ẩn ở hồ sơ công khai).
  const city = form.city.trim() && form.showOnMap ? ` · ${form.city.trim()}` : '';

  return (
    <div className="overflow-hidden rounded-2xl border border-[#f0ebe6]">
      <div className="h-32 bg-gradient-to-b from-[#ffe2cc] to-[#ffc7a0]" />
      <div className="px-[18px] pb-[18px]">
        <div className="relative -mt-12 grid size-24 place-items-center overflow-hidden rounded-full border-4 border-white bg-[#2f4fa8] text-[28px] font-extrabold text-white shadow-[0_6px_16px_rgba(0,0,0,.12)]">
          {form.avatarUrl ? <img src={resolveApiPath(form.avatarUrl)} alt="" className="size-full object-cover" /> : initialsOf(form.first, form.last)}
        </div>
        <div className="mt-2.5 text-[21px] font-extrabold tracking-[-.01em] break-words">{fullName}</div>
        <div className="mt-0.5 text-sm text-stone-500 break-words">
          {handle}
          {city}
        </div>
        <div className="mt-2.5 text-[14.5px] leading-[1.6] break-words whitespace-pre-line text-stone-800">{form.bio || t('profilePreview.noBio')}</div>
        <div className="mt-3.5 grid grid-cols-3 border-y border-[#f0ebe6] text-center">
          <div className="border-r border-[#f0ebe6] px-1 py-3">
            <div className="text-[13.5px] text-stone-600">{t('profilePreview.level')}</div>
            <div className="text-[19px] font-extrabold">{stats?.level ?? '–'}</div>
          </div>
          <div className="border-r border-[#f0ebe6] px-1 py-3">
            <div className="text-[19px] font-extrabold">{stats?.points ?? '–'}</div>
            <div className="text-[13.5px] text-stone-600">{t('profilePreview.points')}</div>
          </div>
          <div className="px-1 py-3">
            <div className="text-[19px] font-extrabold">{stats?.communities ?? '–'}</div>
            <div className="text-[13.5px] text-stone-600">{t('profilePreview.communities')}</div>
          </div>
        </div>
        {links.length > 0 && (
          <div className="mt-3 flex gap-2">
            {links.map((l) => (
              <span key={l.icon} className="grid size-[34px] place-items-center rounded-[10px] bg-[#f5f2ef]">
                <MaterialIcon name={l.icon} size={18} color={l.color} />
              </span>
            ))}
          </div>
        )}
        {stats?.joinedAt && (
          <div className="mt-3 flex items-center gap-2 text-[13.5px] text-stone-600">
            <MaterialIcon name="calendar_month" size={19} />
            {joinedLabel(stats.joinedAt)}
          </div>
        )}
      </div>
    </div>
  );
}
