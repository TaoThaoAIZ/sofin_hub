import { useState, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/Button';
import { useCategories } from '../../../courses/queries';
import { CoverField } from '../../../community/components/CoverField';
import type { CategoryId, CommunityDetail, Language, Visibility } from '../../../courses/types';
import { useUpdateCommunity } from '../../queries';
import { ROLE_RANK, type UpdateCommunityInput, type ViewerRole } from '../../types';
import { ErrorLine, errorText, INPUT_CLASS } from '../Modal';

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13.5px] font-semibold text-stone-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

/** Thông tin chung (admin+). Giá & chế độ riêng tư chỉ Owner/Platform Admin sửa được (BE cũng chặn). */
export function GeneralTab({ course, viewerRole }: { course: CommunityDetail; viewerRole: ViewerRole }) {
  const { t } = useTranslation('communities');
  const { data: categories = [] } = useCategories();
  const update = useUpdateCommunity(course.id);
  const isOwner = ROLE_RANK[viewerRole] >= ROLE_RANK.owner;

  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [thumbnail, setThumbnail] = useState(course.thumbnail);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryId>(course.category);
  const [language, setLanguage] = useState<Language>(course.language);
  const [visibility, setVisibility] = useState<Visibility>(course.visibility);
  const [priceText, setPriceText] = useState(String(course.priceUsd));
  const [localError, setLocalError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(false);
    const price = Number(priceText);
    if (title.trim().length < 3 || title.trim().length > 80) return setLocalError(t('general.errTitle'));
    if (!description.trim()) return setLocalError(t('general.errDesc'));
    if (isOwner && (priceText.trim() === '' || !Number.isFinite(price) || price < 0 || price > 10000)) {
      return setLocalError(t('general.errPrice'));
    }
    setLocalError(null);

    // Chỉ gửi những trường thực sự thay đổi (tránh đụng quyền owner-only khi admin lưu).
    const patch: UpdateCommunityInput = {};
    if (title.trim() !== course.title) patch.title = title.trim();
    if (description.trim() !== course.description) patch.description = description.trim();
    if (thumbnail.trim() && thumbnail.trim() !== course.thumbnail) patch.thumbnail = thumbnail.trim();
    if (category !== course.category) patch.category = category;
    if (language !== course.language) patch.language = language;
    if (isOwner && visibility !== course.visibility) patch.visibility = visibility;
    if (isOwner && price !== course.priceUsd) patch.priceUsd = price;
    if (Object.keys(patch).length === 0) return setLocalError(t('general.errNoChange'));

    update.mutate(patch, { onSuccess: () => setSaved(true) });
  };

  return (
    <section className="glass flex flex-col gap-5 rounded-[26px] p-6">
      <h2 className="m-0 text-lg font-extrabold">{t('general.title')}</h2>
      <Field label={t('general.name')}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={INPUT_CLASS} />
      </Field>
      <Field label={t('general.description')}>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={5} className={`${INPUT_CLASS} resize-none`} />
      </Field>
      <CoverField value={thumbnail} onChange={setThumbnail} onError={setUploadError} label={t('general.thumbnail')} ariaLabel={t('general.thumbnail')} height={170} />
      {uploadError && <p className="m-0 text-sm font-medium text-red-600">{uploadError}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('general.category')}>
          <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId)} className={INPUT_CLASS}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('general.language')}>
          <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className={INPUT_CLASS}>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </Field>
      </div>

      <div className="rounded-2xl border border-[rgba(120,60,20,.1)] bg-white/60 p-4">
        <div className="text-[15px] font-bold">{t('general.priceVisibility')}</div>
        {isOwner ? (
          <div className="mt-3 grid gap-5 sm:grid-cols-2">
            <Field label={t('general.visibility')}>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)} className={INPUT_CLASS}>
                <option value="public">{t('general.public')}</option>
                <option value="private">{t('general.privateOption')}</option>
              </select>
            </Field>
            <Field label={t('general.price')} hint={t('general.priceHint')}>
              <input value={priceText} onChange={(e) => setPriceText(e.target.value)} inputMode="decimal" className={INPUT_CLASS} />
            </Field>
          </div>
        ) : (
          <p className="mt-2 text-sm text-stone-600">
            <Trans
              ns="communities"
              i18nKey="general.current"
              values={{
                visibility: course.visibility === 'private' ? t('general.private') : t('general.public'),
                price: course.priceUsd === 0 ? t('general.free') : t('general.perMonth', { price: course.priceUsd }),
              }}
              components={{ b: <b /> }}
            />
          </p>
        )}
      </div>

      {localError && <ErrorLine>{localError}</ErrorLine>}
      {update.isError && <ErrorLine>{errorText(update.error)}</ErrorLine>}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={update.isPending} className="h-11 rounded-xl px-6 text-sm font-bold">
          {update.isPending ? t('general.saving') : t('general.save')}
        </Button>
        {saved && !update.isPending && !localError && <span className="text-sm text-green-700">{t('general.saved')}</span>}
      </div>
    </section>
  );
}
