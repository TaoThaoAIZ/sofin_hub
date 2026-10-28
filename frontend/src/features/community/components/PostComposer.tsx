import { useRef, useState } from 'react';
import { Avatar } from '../../account/components/Avatar';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useAuth } from '../../auth/AuthContext';
import { useUpload } from '../../uploads/useUpload';
import { useCreatePost, useMembers } from '../queries';
import type { PostCategory } from '../types';
import { absoluteUrl, areaCls, errText, ErrorNote, inputCls, toast } from './contentUi';

const MAX_CONTENT = 4000;
const MAX_MENTIONS = 10;


export function PostComposer({ courseId }: { courseId: string }) {
  const { t } = useTranslation('community');
  const { user } = useAuth();
  const createPost = useCreatePost(courseId);
  const { upload, uploading, error: uploadError } = useUpload();
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState('');
  const category: PostCategory = 'Thảo luận chung';
  const [mentions, setMentions] = useState<{ id: string; name: string }[]>([]);
  // Gõ @ trong ô nội dung => gợi ý thành viên, lọc theo ký tự gõ sau @.
  const [caret, setCaret] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(true);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const [files, setFiles] = useState<{ url: string; name: string }[]>([]);
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [pollCloses, setPollCloses] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mentionMatch = /(^|\s)@([^\s@]{0,30})$/.exec(content.slice(0, caret));
  const mentionQuery = mentionMatch ? mentionMatch[2]! : null;
  const showPicker = pickerOpen && mentionQuery !== null;
  const membersQuery = useMembers(courseId, { q: mentionQuery || undefined, sort: 'active' }, showPicker);
  const candidates = (membersQuery.data?.data ?? []).filter((m) => m.id !== user?.id && !mentions.some((x) => x.id === m.id)).slice(0, 6);
  const addMention = (m: { id: string; name: string }) => {
    if (!mentionMatch) return;
    if (mentions.length >= MAX_MENTIONS) {
      setError(t('composer.maxMentions', { max: MAX_MENTIONS }));
      return;
    }
    const start = caret - mentionMatch[2]!.length - 1; // vị trí dấu @
    const label = `@${m.name} `;
    setContent(content.slice(0, start) + label + content.slice(caret));
    setMentions([...mentions, { id: m.id, name: m.name }]);
    setError(null);
    const pos = start + label.length;
    setCaret(pos);
    requestAnimationFrame(() => {
      textRef.current?.focus();
      textRef.current?.setSelectionRange(pos, pos);
    });
  };
  const startMention = () => {
    const el = textRef.current;
    const pos = el?.selectionStart ?? content.length;
    const before = content.slice(0, pos);
    // Đang có "@" chờ gắn thẻ ngay trước con trỏ: bấm lại = hủy (xóa "@" thừa) thay vì chèn thêm một "@" nữa.
    if (showPicker && before.endsWith('@')) {
      setContent(before.slice(0, -1).replace(/ $/, '') + content.slice(pos));
      setCaret(Math.max(0, before.slice(0, -1).replace(/ $/, '').length));
      setPickerOpen(false);
      requestAnimationFrame(() => el?.focus());
      return;
    }
    const lead = before && !/\s$/.test(before) ? ' ' : '';
    setContent(before + lead + '@' + content.slice(pos));
    const np = pos + lead.length + 1;
    setCaret(np);
    setPickerOpen(true);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(np, np);
    });
  };

  const pickImage = async (file?: File) => {
    if (!file) return;
    setError(null);
    try {
      const up = await upload(file, { purpose: 'post_image' });
      setImage({ url: absoluteUrl(up.url), name: up.name });
    } catch (e) {
      setError(errText(e));
    }
  };

  const pickFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    try {
      const up = await upload(file, { purpose: 'post_file', courseId });
      setFiles((cur) => [...cur, { url: absoluteUrl(up.url), name: up.name }]);
    } catch (e) {
      setError(errText(e));
    }
  };

  const filledOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
  // Tệp đính kèm: API bài viết chưa có trường riêng nên chèn liên kết vào cuối nội dung.
  const fileBlock = files.length ? `\n\n${files.map((f) => t('composer.attachmentLine', { name: f.name, url: f.url })).join('\n')}` : '';
  // Thành viên được gắn tên: dòng cuối "Gắn thẻ: [[user:<id>|<tên>]] ..." (backend gửi thông báo, PostCard hiển thị thành liên kết).
  const cleanName = (n: string) => n.replace(/[[\]|\r\n]/g, ' ').trim();
  const liveMentions = mentions.filter((m) => content.includes(`@${m.name}`));
  const mentionBlock = liveMentions.length ? '\n\n' + t('composer.mentionPrefix') + ': ' + liveMentions.map((m) => `[[user:${m.id}|${cleanName(m.name)}]]`).join(' ') : '';
  const fullContent = content.trim() + fileBlock + mentionBlock;
  const tooLong = fullContent.length > MAX_CONTENT;
  const pollInvalid = showPoll && filledOptions.length < 2;
  const canSubmit = !!content.trim() && !tooLong && !pollInvalid && !createPost.isPending && !uploading;

  const submit = () => {
    setError(null);
    if (showPoll && pollCloses && new Date(pollCloses).getTime() <= Date.now()) {
      setError(t('composer.pollFuture'));
      return;
    }
    createPost.mutate(
      {
        content: fullContent,
        category,
        imageUrl: image?.url,
        poll: showPoll
          ? {
              question: pollQuestion.trim() || undefined,
              options: filledOptions,
              multiple: pollMultiple,
              closesAt: pollCloses ? new Date(pollCloses).toISOString() : undefined,
            }
          : undefined,
      },
      {
        onSuccess: () => {
          setContent('');
          setMentions([]);
          setImage(null);
          setFiles([]);
          setShowPoll(false);
          setPollQuestion('');
          setPollOptions(['', '']);
          setPollMultiple(false);
          setPollCloses('');
          toast(t('composer.posted'));
        },
        onError: (e) => setError(errText(e)),
      },
    );
  };

  const toolBtn = (active: boolean) =>
    `flex h-9 flex-none items-center gap-2 rounded-lg px-3 text-[13px] font-medium whitespace-nowrap max-md:gap-1 max-md:px-2 max-md:text-xs hover:bg-stone-100 disabled:opacity-50 ${active ? 'bg-brand/10 text-brand' : 'text-stone-700'}`;

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <Avatar url={user?.avatarUrl} name={user?.firstName ?? '?'} size={48} className="bg-brand/10 text-brand" />
        <div className="relative flex-1">
        <textarea
          ref={textRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setCaret(e.target.selectionStart);
            setPickerOpen(true);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyDown={(e) => e.key === 'Escape' && setPickerOpen(false)}
          rows={content.includes('\n') || content.length > 80 ? 4 : 2}
          placeholder={t('composer.placeholder')}
          aria-label={t('composer.contentAria')}
          className={`${areaCls} min-h-12 w-full resize-y bg-[#fbf9f7]`}
        />
        {showPicker && (
          <ul role="listbox" aria-label={t('composer.mentionAria')} className="absolute top-full left-0 z-20 m-0 mt-1 flex max-h-64 w-full max-w-sm list-none flex-col gap-0.5 overflow-y-auto rounded-xl border border-[rgba(120,60,20,.12)] bg-white p-1.5 shadow-lg">
            {candidates.map((m) => (
              <li key={m.id} role="option" aria-selected={false}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => addMention(m)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-brand/10">
                  <Avatar url={m.avatarUrl} name={m.name} size={28} className="bg-brand/10 text-brand" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{m.name}</span>
                  <span className="text-[12px] text-stone-400">@{m.handle}</span>
                </button>
              </li>
            ))}
            {candidates.length === 0 && <li className="px-2 py-1.5 text-[12.5px] text-stone-400">{membersQuery.isFetching ? t('composer.mentionSearching') : t('composer.mentionEmpty')}</li>}
          </ul>
        )}
        </div>
      </div>

      {image && (
        <div className="relative w-fit">
          <img src={image.url} alt={image.name} className="max-h-64 rounded-xl border border-[rgba(120,60,20,.1)] bg-stone-50 object-contain" />
          <button
            type="button"
            onClick={() => setImage(null)}
            aria-label={t('composer.removeImage')}
            className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-[#1c1917] text-white dark:bg-[#2a3036]"
          >
            <MaterialIcon name="close" size={14} color="#fff" />
          </button>
        </div>
      )}

      {files.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {files.map((f, i) => (
            <li key={f.url} className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-1.5 text-[13px]">
              <MaterialIcon name="attach_file" size={16} color="#57534e" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <button type="button" aria-label={t('composer.removeFile', { name: f.name })} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-stone-400 hover:text-stone-700">
                <MaterialIcon name="close" size={16} />
              </button>
            </li>
          ))}
          <li className="text-[11.5px] text-stone-400">{t('composer.fileNote')}</li>
        </ul>
      )}

      {showPoll && (
        <div className="flex flex-col gap-2 rounded-xl border border-[rgba(120,60,20,.1)] bg-white p-3">
          <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} maxLength={200} placeholder={t('composer.pollQuestionPh')} aria-label={t('composer.pollQuestionAria')} className={inputCls} />
          {pollOptions.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={o}
                onChange={(e) => setPollOptions(pollOptions.map((x, j) => (j === i ? e.target.value : x)))}
                maxLength={100}
                placeholder={t('composer.option', { n: i + 1 })}
                aria-label={t('composer.option', { n: i + 1 })}
                className={inputCls}
              />
              {pollOptions.length > 2 && (
                <button type="button" aria-label={t('composer.removeOption', { n: i + 1 })} onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))} className="text-stone-400 hover:text-red-600">
                  <MaterialIcon name="delete" size={19} />
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
            {pollOptions.length < 6 && (
              <button type="button" onClick={() => setPollOptions([...pollOptions, ''])} className="flex items-center gap-1 font-semibold text-brand">
                <MaterialIcon name="add" size={17} color="#ff570a" /> {t('composer.addOption')}
              </button>
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={pollMultiple} onChange={(e) => setPollMultiple(e.target.checked)} /> {t('composer.allowMultiple')}
            </label>
            <label className="flex items-center gap-2">
              {t('composer.closesAt')}
              <input type="datetime-local" value={pollCloses} onChange={(e) => setPollCloses(e.target.value)} className="h-9 rounded-lg border border-[rgba(120,60,20,.12)] px-2 text-[13px]" />
            </label>
          </div>
          {pollInvalid && <p className="m-0 text-[12px] text-stone-500">{t('composer.pollMin')}</p>}
        </div>
      )}

      <div className="flex items-center gap-1 max-md:flex-nowrap max-md:overflow-x-auto md:flex-wrap [&::-webkit-scrollbar]:hidden">
        <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => { void pickImage(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={videoInput} type="file" accept="video/mp4" hidden onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={fileInput} type="file" hidden onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
        <button type="button" onClick={() => imageInput.current?.click()} disabled={uploading} className={toolBtn(!!image)}>
          <MaterialIcon name="image" size={19} color="currentColor" /> {t('composer.image')}
        </button>
        <button type="button" onClick={() => videoInput.current?.click()} disabled={uploading} title={t('composer.videoHint')} className={toolBtn(files.some((f) => /\.mp4$/i.test(f.name)))}>
          <MaterialIcon name="smart_display" size={19} color="currentColor" /> {t('composer.video')}
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className={toolBtn(files.length > 0)}>
          <MaterialIcon name="attach_file" size={19} color="currentColor" /> {t('composer.attachFile')}
        </button>
        <button type="button" onClick={startMention} className={toolBtn(mentions.length > 0)}>
          <MaterialIcon name="sell" size={19} color="currentColor" /> {t('composer.tagBtn')}{liveMentions.length ? ` (${liveMentions.length})` : ''}
        </button>
        <button type="button" onClick={() => setShowPoll((s) => !s)} className={toolBtn(showPoll)}>
          <MaterialIcon name="bar_chart" size={19} color="currentColor" /> {t('composer.poll')}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="relative ml-auto flex h-10 flex-none items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white max-md:size-9 max-md:justify-center max-md:p-0 disabled:opacity-50"
        >
          <MaterialIcon name="send" size={17} color="#fff" />
          <span className="max-md:sr-only">{createPost.isPending ? t('composer.posting') : uploading ? t('composer.uploading') : t('composer.submit')}</span>
        </button>
      </div>
      <div className="flex justify-between text-[11.5px] text-stone-400">
        <span>{tooLong ? <span className="text-red-600">{t('composer.tooLong')}</span> : ''}</span>
        <span className={tooLong ? 'text-red-600' : ''}>
          {fullContent.length}/{MAX_CONTENT}
        </span>
      </div>
      <ErrorNote message={error ?? uploadError} />
    </div>
  );
}
