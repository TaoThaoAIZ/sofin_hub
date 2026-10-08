import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../../account/components/Avatar';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useClickOutside } from '../../../lib/useClickOutside';
import { fileKeyOf, useFileUrl } from '../../../lib/files';
import { useAuth } from '../../auth/AuthContext';
import * as api from '../api';
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useDeletePost,
  useReportContent,
  useSetPostHidden,
  useToggleLike,
  useTogglePin,
  useUpdateComment,
  useUpdatePost,
  useVotePoll,
} from '../queries';
import { categoryLabel, POST_CATEGORIES, REPORT_REASONS, reportReasonLabel, type Comment, type Post, type PostCategory, type ReportReason } from '../types';
import { areaCls, ConfirmDialog, copyText, Dialog, errText, ErrorNote, fmtDateTime, ghostBtn, inputCls, isModPlus, primaryBtn, safeUrl, toast, type ViewerRole } from './contentUi';

export const CATEGORY_META: Record<PostCategory, { icon: string; color: string }> = {
  'Thảo luận chung': { icon: 'chat_bubble', color: '#2563eb' },
  'Hỏi đáp': { icon: 'headset_mic', color: '#2563eb' },
  'Case study': { icon: 'assignment', color: '#f59e0b' },
  'Thông báo': { icon: 'campaign', color: '#ef4444' },
};

const tagLabel = (tg: string) => `#${tg.replace(/^#+/, '')}`;

// ---------------------------------------------------------------- Báo cáo
function ReportDialog({ kind, id, onClose }: { kind: 'posts' | 'comments'; id: string; onClose: () => void }) {
  const { t } = useTranslation('community');
  const report = useReportContent();
  const [reason, setReason] = useState<ReportReason>('spam');
  const [detail, setDetail] = useState('');
  return (
    <Dialog
      title={kind === 'posts' ? t('post.report.titlePost') : t('post.report.titleComment')}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostBtn}>
            {t('ui.cancel')}
          </button>
          <button
            type="button"
            disabled={report.isPending}
            className={primaryBtn}
            onClick={() =>
              report.mutate(
                { kind, id, reason, detail: detail.trim() },
                {
                  onSuccess: () => {
                    toast(t('post.report.sent'));
                    onClose();
                  },
                },
              )
            }
          >
            {report.isPending ? t('post.report.sending') : t('post.report.send')}
          </button>
        </>
      }
    >
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-[13px] font-semibold">{t('post.report.reason')}</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r.key} className="flex items-center gap-2.5">
            <input type="radio" name={`reason-${id}`} checked={reason === r.key} onChange={() => setReason(r.key)} />
            {reportReasonLabel(r.key)}
          </label>
        ))}
      </fieldset>
      <textarea value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={1000} rows={3} placeholder={t('post.report.detailPh')} aria-label={t('post.report.detailAria')} className={`${areaCls} mt-3`} />
      <div className="mt-2">
        <ErrorNote message={report.isError ? errText(report.error) : null} />
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Poll
function PollBlock({ courseId, post }: { courseId: string; post: Post }) {
  const { t } = useTranslation('community');
  const poll = post.poll!;
  const vote = useVotePoll(courseId);
  const [picked, setPicked] = useState<string[]>(poll.viewerVotes);
  useEffect(() => setPicked(poll.viewerVotes), [poll.viewerVotes]);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (id: string) => {
    if (poll.isClosed) return;
    setPicked((cur) => (poll.multiple ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id]));
  };
  const same = picked.length === poll.viewerVotes.length && picked.every((x) => poll.viewerVotes.includes(x));
  const voted = poll.viewerVotes.length > 0;

  return (
    <div className="mt-3 rounded-2xl border border-[rgba(120,60,20,.1)] bg-[#fbf9f7] p-3.5">
      {poll.question && <div className="mb-2 text-[14.5px] font-bold">{poll.question}</div>}
      <div className="flex flex-col gap-2">
        {poll.options.map((o) => {
          const pct = poll.totalVoters ? Math.round((o.count / poll.totalVoters) * 100) : 0;
          const mine = picked.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              disabled={poll.isClosed || vote.isPending}
              aria-pressed={mine}
              className={`relative flex h-10 items-center justify-between overflow-hidden rounded-xl border px-3 text-left text-[13.5px] disabled:cursor-default ${
                mine ? 'border-brand' : 'border-[rgba(120,60,20,.12)]'
              } bg-white`}
            >
              <span className="absolute inset-y-0 left-0 bg-brand/15" style={{ width: `${pct}%` }} />
              <span className="relative flex min-w-0 items-center gap-2">
                <MaterialIcon name={mine ? (poll.multiple ? 'check_box' : 'radio_button_checked') : poll.multiple ? 'check_box_outline_blank' : 'radio_button_unchecked'} size={18} color={mine ? '#f26a1b' : '#a8a29e'} />
                <span className="truncate">{o.text}</span>
              </span>
              <span className="relative flex-none pl-2 text-[12.5px] font-semibold text-stone-600">
                {pct}% · {o.count}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[12px] text-stone-500">
        <span>{t('post.poll.voted', { count: poll.totalVoters })}</span>
        {poll.multiple && <span>{t('post.poll.multiple')}</span>}
        {poll.isClosed ? (
          <span className="rounded-md bg-stone-200 px-1.5 py-0.5 font-semibold text-stone-600">{t('post.poll.closed')}</span>
        ) : (
          poll.closesAt && <span>{t('post.poll.closesAt', { date: fmtDateTime(poll.closesAt) })}</span>
        )}
        {!poll.isClosed && (
          <button
            type="button"
            disabled={vote.isPending || picked.length === 0 || same}
            onClick={() => {
              setErr(null);
              vote.mutate({ postId: post.id, optionIds: picked }, { onError: (e) => setErr(errText(e)) });
            }}
            className="ml-auto h-8 rounded-lg bg-brand px-3 text-[12.5px] font-bold text-white disabled:opacity-50"
          >
            {vote.isPending ? t('post.poll.sending') : voted ? t('post.poll.change') : t('post.poll.vote')}
          </button>
        )}
      </div>
      <div className="mt-1.5">
        <ErrorNote message={err} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Bình luận
function CommentRow({ courseId, postId, c, viewerId, canModerate }: { courseId: string; postId: string; c: Comment; viewerId?: string; canModerate: boolean }) {
  const { t } = useTranslation('community');
  const update = useUpdateComment(postId);
  const remove = useDeleteComment(courseId, postId);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.content);
  const [confirmDel, setConfirmDel] = useState(false);
  const [reporting, setReporting] = useState(false);
  const own = c.authorId === viewerId;

  return (
    <div className={`flex gap-2.5 text-[13.5px] ${c.hidden ? 'opacity-60' : ''}`}>
      <Avatar url={c.author.avatarUrl} name={c.author.name} size={32} className="bg-stone-200 text-stone-700" />
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              update.mutate({ commentId: c.id, content: text }, { onSuccess: () => setEditing(false) });
            }}
            className="flex flex-col gap-1.5"
          >
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={1000} aria-label={t('post.comment.editAria')} className={areaCls} />
            <ErrorNote message={update.isError ? errText(update.error) : null} />
            <div className="flex gap-2">
              <button type="submit" disabled={update.isPending || !text.trim()} className="h-8 rounded-lg bg-brand px-3 text-[12.5px] font-bold text-white disabled:opacity-50">
                {t('post.comment.save')}
              </button>
              <button type="button" onClick={() => { setEditing(false); setText(c.content); }} className="h-8 rounded-lg px-3 text-[12.5px] font-semibold text-stone-600">
                {t('ui.cancel')}
              </button>
            </div>
          </form>
        ) : (
          <>
            <Link to={`/users/${c.author.id}`} className="font-semibold hover:text-brand">
              {c.author.name}
            </Link>{' '}
            <span className="whitespace-pre-wrap text-stone-700">{c.content}</span>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-stone-400">
              <span>{fmtDateTime(c.createdAt)}</span>
              {c.editedAt && <span>{t('post.comment.edited')}</span>}
              {c.hidden && <span className="font-semibold text-stone-500">{t('post.comment.hidden')}</span>}
              {own && (
                <button type="button" onClick={() => setEditing(true)} className="hover:text-brand">
                  {t('post.comment.edit')}
                </button>
              )}
              {(own || canModerate) && (
                <button type="button" onClick={() => setConfirmDel(true)} className="hover:text-red-600">
                  {t('post.comment.delete')}
                </button>
              )}
              {!own && (
                <button type="button" onClick={() => setReporting(true)} className="inline-flex items-center gap-1 font-medium text-stone-500 hover:text-brand">
                  <MaterialIcon name="flag" size={13} />
                  {t('post.comment.report')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {confirmDel && (
        <ConfirmDialog
          title={t('post.comment.deleteTitle')}
          message={t('post.comment.deleteMsg')}
          confirmLabel={t('post.comment.delete')}
          pending={remove.isPending}
          error={remove.isError ? errText(remove.error) : null}
          onClose={() => setConfirmDel(false)}
          onConfirm={() => remove.mutate(c.id, { onSuccess: () => { setConfirmDel(false); toast(t('post.comment.deleted')); } })}
        />
      )}
      {reporting && <ReportDialog kind="comments" id={c.id} onClose={() => setReporting(false)} />}
    </div>
  );
}

// Tệp đính kèm bài viết được chèn vào cuối nội dung dạng "Tệp đính kèm: <tên> — <url>" (xem PostComposer). Tách ra để hiển thị video/tệp đúng dạng.
const ATTACH_RE = /^(?:Tệp đính kèm|Attachment): (.+?) — (\S+)$/;
const isVideoName = (n: string, url: string) => /\.mp4$/i.test(n) || /\.mp4(?:[?#]|$)/i.test(url);

function splitContent(content: string) {
  const text: string[] = [];
  const files: { name: string; url: string }[] = [];
  for (const line of content.split('\n')) {
    const m = ATTACH_RE.exec(line.trim());
    if (m) files.push({ name: m[1]!, url: m[2]! });
    else text.push(line);
  }
  return { text: text.join('\n').trim(), files };
}

function PostFile({ name, url }: { name: string; url: string }) {
  const signed = useFileUrl(url);
  const href = fileKeyOf(url) ? signed : safeUrl(url);
  const video = isVideoName(name, url);
  if (href === undefined) return <div className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-400">{name}…</div>;
  if (!href) return <div className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-400">{name}</div>;
  if (video) {
    return (
      <div className="overflow-hidden rounded-2xl bg-black">
        <video src={href} controls playsInline preload="metadata" aria-label={name} className="max-h-[480px] w-full" />
      </div>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" download className="flex items-center gap-2.5 rounded-xl border border-[rgba(120,60,20,.1)] bg-white px-3 py-2 text-[13.5px] hover:border-brand">
      <MaterialIcon name="attach_file" size={18} color="#f26a1b" />
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
    </a>
  );
}

function CommentsSection({ courseId, post, viewerId, canModerate }: { courseId: string; post: Post; viewerId?: string; canModerate: boolean }) {
  const { t } = useTranslation('community');
  const comments = useComments(post.id, true);
  const create = useCreateComment(courseId, post.id);
  const [draft, setDraft] = useState('');
  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-[rgba(120,60,20,.08)] pt-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          create.mutate(draft, { onSuccess: () => setDraft('') });
        }}
        className="flex items-center gap-2"
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} placeholder={t('post.comment.placeholder')} aria-label={t('post.comment.writeAria')} className="h-9 flex-1 rounded-full border border-[rgba(120,60,20,.12)] bg-white px-4 text-[13.5px] outline-0" />
        <button type="submit" disabled={create.isPending || !draft.trim()} className="h-9 rounded-full bg-brand px-4 text-[13px] font-bold text-white disabled:opacity-50">
          {t('post.comment.send')}
        </button>
      </form>
      <ErrorNote message={create.isError ? errText(create.error) : null} />
      {comments.isPending && <p className="text-xs text-stone-400">{t('post.comment.loading')}</p>}
      {comments.isError && <ErrorNote message={errText(comments.error, t('post.comment.loadFailed'))} />}
      {comments.data?.length === 0 && <p className="m-0 text-xs text-stone-400">{t('post.comment.empty')}</p>}
      {[...(comments.data ?? [])].reverse().map((c) => (
        <CommentRow key={c.id} courseId={courseId} postId={post.id} c={c} viewerId={viewerId} canModerate={canModerate} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Bài viết
export function PostCard({
  courseId,
  post,
  viewerRole,
  highlighted = false,
  onTagClick,
}: {
  courseId: string;
  post: Post;
  viewerRole: ViewerRole;
  highlighted?: boolean;
  onTagClick?: (tag: string) => void;
}) {
  const { t } = useTranslation('community');
  const { user } = useAuth();
  const like = useToggleLike(courseId);
  const pin = useTogglePin(courseId);
  const update = useUpdatePost(courseId);
  const remove = useDeletePost(courseId);
  const setHidden = useSetPostHidden(courseId);
  const { accessToken } = useAuth();

  const [showComments, setShowComments] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setMenuOpen(false));
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content);
  const [editCategory, setEditCategory] = useState<PostCategory>(post.category);
  const [editTags, setEditTags] = useState(post.tags.map((tg) => tg.replace(/^#+/, '')).join(', '));
  const [confirmDel, setConfirmDel] = useState(false);
  const [reporting, setReporting] = useState(false);

  const isAuthor = !!user && post.authorId === user.id;
  const mod = isModPlus(viewerRole);
  const catMeta = CATEGORY_META[post.category];
  const img = safeUrl(post.imageUrl);
  const parts = splitContent(post.content);

  const share = async () => {
    try {
      const s = await api.fetchPostShare(post.id, accessToken!);
      const url = s.url.startsWith('/') ? `${window.location.origin}${s.url}` : s.url;
      toast((await copyText(url)) ? t('post.shareCopied') : t('post.shareManual', { url }), 'ok');
    } catch (e) {
      toast(errText(e, t('post.shareFailed')), 'error');
    }
  };

  const startEdit = () => {
    setEditText(post.content);
    setEditCategory(post.category);
    setEditTags(post.tags.map((tg) => tg.replace(/^#+/, '')).join(', '));
    setEditing(true);
    setMenuOpen(false);
  };

  const saveEdit = () => {
    const tags = editTags
      .split(/[,\s]+/)
      .map((tg) => tg.replace(/^#+/, '').trim())
      .filter(Boolean);
    update.mutate(
      { postId: post.id, body: { content: editText, category: editCategory, tags } },
      {
        onSuccess: () => {
          setEditing(false);
          toast(t('post.saved'));
        },
      },
    );
  };

  const menuItem = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] hover:bg-stone-50';

  return (
    <article
      id={`post-${post.id}`}
      className={`relative flex gap-4 rounded-[20px] border bg-white p-4 shadow-[0_8px_24px_rgba(120,60,20,.06)] ${
        highlighted ? 'border-brand ring-2 ring-brand/30' : 'border-[rgba(120,60,20,.08)]'
      } ${post.hidden ? 'opacity-70' : ''}`}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <Avatar url={post.author.avatarUrl} name={post.author.name} size={46} className="bg-stone-200 text-stone-700" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 pr-16 text-[12.5px] text-stone-500">
            <Link to={`/users/${post.author.id}`} className="text-[14.5px] font-bold text-stone-900 hover:text-brand">
              {post.author.name}
            </Link>
            <span>{fmtDateTime(post.createdAt)}</span>
            {post.editedAt && <span title={fmtDateTime(post.editedAt)}>{t('post.edited')}</span>}
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <MaterialIcon name={catMeta.icon} size={15} color={catMeta.color} />
              {categoryLabel(post.category)}
            </span>
            {post.pinned && (
              <span className="flex items-center gap-1 rounded-lg bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
                <MaterialIcon name="push_pin" size={13} filled color="#f26a1b" /> {t('post.pinned')}
              </span>
            )}
            {post.hidden && (
              <span className="flex items-center gap-1 rounded-lg bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-600" title={t('post.hiddenTitle')}>
                <MaterialIcon name="visibility_off" size={13} color="#57534e" /> {t('post.hidden')}
              </span>
            )}
          </div>

          {editing ? (
            <div className="mt-2 flex flex-col gap-2">
              <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={5} maxLength={4000} aria-label={t('post.editAria')} className={areaCls} />
              <div className="flex flex-wrap gap-2">
                <select value={editCategory} onChange={(e) => setEditCategory(e.target.value as PostCategory)} aria-label={t('post.categoryAria')} className="h-9 rounded-lg border border-[rgba(120,60,20,.12)] bg-white px-2 text-[13px]">
                  {POST_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{categoryLabel(c)}</option>
                  ))}
                </select>
                <input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder={t('post.tagsPh')} aria-label={t('post.tagsAria')} className={`${inputCls} !h-9 min-w-[200px] flex-1`} />
              </div>
              <ErrorNote message={update.isError ? errText(update.error) : null} />
              <div className="flex gap-2">
                <button type="button" onClick={saveEdit} disabled={update.isPending || !editText.trim()} className={`${primaryBtn} !h-9`}>
                  {update.isPending ? t('post.saving') : t('post.save')}
                </button>
                <button type="button" onClick={() => setEditing(false)} className={`${ghostBtn} !h-9`}>
                  {t('ui.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {parts.text && <p className="mt-2 text-[14.5px] leading-[1.6] break-words whitespace-pre-wrap text-stone-800">{parts.text}</p>}
              {parts.files.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {parts.files.map((f, i) => (
                    <PostFile key={f.url + i} name={f.name} url={f.url} />
                  ))}
                </div>
              )}
            </>
          )}

          {img && !editing && <img src={img} alt={t('post.imageAlt')} loading="lazy" className="mt-3 max-h-[560px] w-full rounded-2xl border border-[rgba(120,60,20,.08)] bg-stone-50 object-contain" />}
          {post.poll && !editing && <PollBlock courseId={courseId} post={post} />}

          {post.tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {post.tags.map((tg) => (
                <button key={tg} type="button" onClick={() => onTagClick?.(tg.replace(/^#+/, ''))} className="rounded-lg bg-stone-100 px-2.5 py-1 text-[12px] text-stone-600 hover:bg-brand/10 hover:text-brand" title={t('post.filterTag')}>
                  {tagLabel(tg)}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => like.mutate(post.id)}
              disabled={like.isPending}
              aria-pressed={!!post.viewerLiked}
              className={`flex h-9 items-center gap-2 rounded-xl px-3.5 text-[13px] font-bold transition-colors ${post.viewerLiked ? 'bg-brand text-white shadow-[0_4px_12px_rgba(242,106,27,.35)]' : 'bg-stone-100 text-stone-700 hover:bg-brand/10'}`}
            >
              <MaterialIcon name="thumb_up" size={16} filled={post.viewerLiked} color={post.viewerLiked ? '#ffffff' : '#57534e'} />
              {post.likesCount}
            </button>
            <button type="button" onClick={() => setShowComments((s) => !s)} className="glass-chip flex h-9 items-center gap-2 rounded-xl px-3.5 text-[13px] font-semibold">
              <MaterialIcon name="chat_bubble" size={16} color="#1c1917" />
              {post.commentsCount}
            </button>
            <button type="button" onClick={share} className="glass-chip flex h-9 items-center gap-2 rounded-xl px-3.5 text-[13px] font-medium">
              <MaterialIcon name="ios_share" size={16} color="#1c1917" />
              {t('post.share')}
            </button>

            <div ref={menuRef} className="relative ml-auto">
              <button type="button" onClick={() => setMenuOpen((o) => !o)} aria-label={t('post.moreOptions')} aria-haspopup="menu" aria-expanded={menuOpen} className="grid size-9 place-items-center rounded-xl text-stone-500 hover:bg-stone-100">
                <MaterialIcon name="more_horiz" size={22} />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 bottom-full z-20 mb-1 w-52 rounded-xl border border-[rgba(120,60,20,.12)] bg-white p-1.5 shadow-lg">
                  {(isAuthor || mod) && (
                    <button role="menuitem" type="button" className={menuItem} onClick={startEdit}>
                      <MaterialIcon name="edit" size={18} /> {t('post.editPost')}
                    </button>
                  )}
                  {mod && (
                    <button role="menuitem" type="button" className={menuItem} onClick={() => { setMenuOpen(false); pin.mutate(post.id, { onError: (e) => toast(errText(e), 'error') }); }}>
                      <MaterialIcon name="push_pin" size={18} /> {post.pinned ? t('post.unpin') : t('post.pin')}
                    </button>
                  )}
                  {mod && (
                    <button
                      role="menuitem"
                      type="button"
                      className={menuItem}
                      onClick={() => {
                        setMenuOpen(false);
                        setHidden.mutate(
                          { postId: post.id, hidden: !post.hidden },
                          { onSuccess: () => toast(post.hidden ? t('post.unhideToast') : t('post.hideToast')), onError: (e) => toast(errText(e), 'error') },
                        );
                      }}
                    >
                      <MaterialIcon name={post.hidden ? 'visibility' : 'visibility_off'} size={18} /> {post.hidden ? t('post.unhide') : t('post.hide')}
                    </button>
                  )}
                  {(isAuthor || mod) && (
                    <button role="menuitem" type="button" className={`${menuItem} text-red-600`} onClick={() => { setMenuOpen(false); setConfirmDel(true); }}>
                      <MaterialIcon name="delete" size={18} color="#dc2626" /> {t('post.deletePost')}
                    </button>
                  )}
                  {!isAuthor && (
                    <button role="menuitem" type="button" className={menuItem} onClick={() => { setMenuOpen(false); setReporting(true); }}>
                      <MaterialIcon name="flag" size={18} /> {t('post.reportBtn')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {showComments && <CommentsSection courseId={courseId} post={post} viewerId={user?.id} canModerate={mod} />}
        </div>
      </div>

      {confirmDel && (
        <ConfirmDialog
          title={t('post.deleteTitle')}
          message={t('post.deleteMsg')}
          confirmLabel={t('post.deletePost')}
          pending={remove.isPending}
          error={remove.isError ? errText(remove.error) : null}
          onClose={() => setConfirmDel(false)}
          onConfirm={() => remove.mutate(post.id, { onSuccess: () => { setConfirmDel(false); toast(t('post.deleted')); } })}
        />
      )}
      {reporting && <ReportDialog kind="posts" id={post.id} onClose={() => setReporting(false)} />}
    </article>
  );
}
