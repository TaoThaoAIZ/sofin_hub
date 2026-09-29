import { useRef, useState } from 'react';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useAuth } from '../../auth/AuthContext';
import { useUpload } from '../../uploads/useUpload';
import { useCreatePost, useTags } from '../queries';
import { POST_CATEGORIES, type PostCategory } from '../types';
import { absoluteUrl, areaCls, errText, ErrorNote, inputCls, toast } from './contentUi';

const MAX_CONTENT = 4000;
const MAX_TAGS = 5;

const normTag = (raw: string) => raw.trim().replace(/^#+/, '').replace(/\s+/g, '').slice(0, 30);

export function PostComposer({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const createPost = useCreatePost(courseId);
  const tagsQuery = useTags(courseId);
  const { upload, uploading, error: uploadError } = useUpload();
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState('');
  const [category, setCategory] = useState<PostCategory>('Thảo luận chung');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showTags, setShowTags] = useState(false);
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const [files, setFiles] = useState<{ url: string; name: string }[]>([]);
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [pollCloses, setPollCloses] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addTag = (raw: string) => {
    const t = normTag(raw);
    if (!t) return;
    if (tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    if (tags.length >= MAX_TAGS) {
      setError(`Tối đa ${MAX_TAGS} thẻ cho mỗi bài viết`);
      return;
    }
    setTags([...tags, t]);
    setTagInput('');
    setError(null);
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
  const fileBlock = files.length ? `\n\n${files.map((f) => `Tệp đính kèm: ${f.name} — ${f.url}`).join('\n')}` : '';
  const fullContent = content.trim() + fileBlock;
  const tooLong = fullContent.length > MAX_CONTENT;
  const pollInvalid = showPoll && filledOptions.length < 2;
  const canSubmit = !!content.trim() && !tooLong && !pollInvalid && !createPost.isPending && !uploading;

  const submit = () => {
    setError(null);
    if (showPoll && pollCloses && new Date(pollCloses).getTime() <= Date.now()) {
      setError('Hạn đóng bình chọn phải ở tương lai');
      return;
    }
    createPost.mutate(
      {
        content: fullContent,
        category,
        tags: tags.length ? tags : undefined,
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
          setTags([]);
          setTagInput('');
          setImage(null);
          setFiles([]);
          setShowPoll(false);
          setPollQuestion('');
          setPollOptions(['', '']);
          setPollMultiple(false);
          setPollCloses('');
          setShowTags(false);
          toast('Đã đăng bài viết');
        },
        onError: (e) => setError(errText(e)),
      },
    );
  };

  const suggestions = (tagsQuery.data ?? []).filter((t) => !tags.some((x) => x.toLowerCase() === normTag(t.tag).toLowerCase())).slice(0, 8);
  const toolBtn = (active: boolean) =>
    `flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-medium hover:bg-stone-100 disabled:opacity-50 ${active ? 'bg-brand/10 text-brand' : 'text-stone-700'}`;

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-12 flex-none place-items-center rounded-full bg-brand/10 text-sm font-bold text-brand">
          {(user?.firstName ?? '?').charAt(0).toUpperCase()}
        </span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={content.includes('\n') || content.length > 80 ? 4 : 2}
          placeholder="Bạn muốn chia sẻ điều gì?"
          aria-label="Nội dung bài viết"
          className={`${areaCls} min-h-12 flex-1 resize-y bg-[#fbf9f7]`}
        />
      </div>

      {image && (
        <div className="relative w-fit">
          <img src={image.url} alt={image.name} className="max-h-48 rounded-xl border border-[rgba(120,60,20,.1)] object-cover" />
          <button
            type="button"
            onClick={() => setImage(null)}
            aria-label="Bỏ ảnh"
            className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-stone-900 text-white"
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
              <button type="button" aria-label={`Bỏ tệp ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-stone-400 hover:text-stone-700">
                <MaterialIcon name="close" size={16} />
              </button>
            </li>
          ))}
          <li className="text-[11.5px] text-stone-400">Tệp sẽ được chèn dưới dạng liên kết vào cuối nội dung bài viết.</li>
        </ul>
      )}

      {showTags && (
        <div className="rounded-xl border border-[rgba(120,60,20,.1)] bg-white p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((t) => (
              <span key={t} className="flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1 text-[12.5px] font-semibold text-brand">
                #{t}
                <button type="button" aria-label={`Bỏ thẻ ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}>
                  <MaterialIcon name="close" size={14} color="#f26a1b" />
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              placeholder={tags.length >= MAX_TAGS ? 'Đã đủ thẻ' : 'Nhập thẻ rồi nhấn Enter'}
              disabled={tags.length >= MAX_TAGS}
              maxLength={30}
              aria-label="Nhập thẻ"
              className="h-8 min-w-[160px] flex-1 border-0 bg-transparent px-1 text-sm outline-0"
            />
          </div>
          {suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-stone-500">
              Gợi ý:
              {suggestions.map((t) => (
                <button key={t.tag} type="button" onClick={() => addTag(t.tag)} className="rounded-lg bg-stone-100 px-2 py-0.5 hover:bg-brand/10 hover:text-brand">
                  #{normTag(t.tag)} <span className="text-stone-400">{t.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showPoll && (
        <div className="flex flex-col gap-2 rounded-xl border border-[rgba(120,60,20,.1)] bg-white p-3">
          <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} maxLength={200} placeholder="Câu hỏi bình chọn (không bắt buộc)" aria-label="Câu hỏi bình chọn" className={inputCls} />
          {pollOptions.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={o}
                onChange={(e) => setPollOptions(pollOptions.map((x, j) => (j === i ? e.target.value : x)))}
                maxLength={100}
                placeholder={`Lựa chọn ${i + 1}`}
                aria-label={`Lựa chọn ${i + 1}`}
                className={inputCls}
              />
              {pollOptions.length > 2 && (
                <button type="button" aria-label={`Xóa lựa chọn ${i + 1}`} onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))} className="text-stone-400 hover:text-red-600">
                  <MaterialIcon name="delete" size={19} />
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
            {pollOptions.length < 6 && (
              <button type="button" onClick={() => setPollOptions([...pollOptions, ''])} className="flex items-center gap-1 font-semibold text-brand">
                <MaterialIcon name="add" size={17} color="#f26a1b" /> Thêm lựa chọn
              </button>
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={pollMultiple} onChange={(e) => setPollMultiple(e.target.checked)} /> Cho chọn nhiều
            </label>
            <label className="flex items-center gap-2">
              Đóng lúc
              <input type="datetime-local" value={pollCloses} onChange={(e) => setPollCloses(e.target.value)} className="h-9 rounded-lg border border-[rgba(120,60,20,.12)] px-2 text-[13px]" />
            </label>
          </div>
          {pollInvalid && <p className="m-0 text-[12px] text-stone-500">Cần ít nhất 2 lựa chọn có nội dung (tối đa 6).</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1">
        <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => { void pickImage(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={fileInput} type="file" hidden onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
        <button type="button" onClick={() => imageInput.current?.click()} disabled={uploading} className={toolBtn(!!image)}>
          <MaterialIcon name="image" size={19} color="currentColor" /> Ảnh
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className={toolBtn(files.length > 0)}>
          <MaterialIcon name="attach_file" size={19} color="currentColor" /> File đính kèm
        </button>
        <button type="button" onClick={() => setShowTags((s) => !s)} className={toolBtn(showTags || tags.length > 0)}>
          <MaterialIcon name="sell" size={19} color="currentColor" /> Gắn thẻ{tags.length ? ` (${tags.length})` : ''}
        </button>
        <button type="button" onClick={() => setShowPoll((s) => !s)} className={toolBtn(showPoll)}>
          <MaterialIcon name="bar_chart" size={19} color="currentColor" /> Poll/Bình chọn
        </button>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as PostCategory)}
          aria-label="Chuyên mục"
          className="h-9 rounded-lg border border-[rgba(120,60,20,.12)] bg-white px-2 text-[13px] font-medium"
        >
          {POST_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="ml-auto flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          <MaterialIcon name="send" size={17} color="#fff" />
          {createPost.isPending ? 'Đang đăng…' : uploading ? 'Đang tải lên…' : 'Đăng bài'}
        </button>
      </div>
      <div className="flex justify-between text-[11.5px] text-stone-400">
        <span>{tooLong ? <span className="text-red-600">Nội dung quá dài</span> : ''}</span>
        <span className={tooLong ? 'text-red-600' : ''}>
          {fullContent.length}/{MAX_CONTENT}
        </span>
      </div>
      <ErrorNote message={error ?? uploadError} />
    </div>
  );
}
