import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../../account/components/Avatar';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError } from '../../../lib/api';
import { formatDateTime } from '../../../lib/datetime';
import { useFileUrl } from '../../../lib/files';
import { useAuth } from '../../auth/AuthContext';
import { useUpload, type UploadedFile } from '../../uploads/useUpload';
import { messageErrorText, useBlockToggle, useDeleteConversation, useMarkConversationRead, useRecallMessage, useSendMessage, useThread } from '../queries';
import type { ConversationView, MessageView } from '../types';
import { usePopup } from '../../../components/ui/usePopup';

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function ChatAttachment({ a, mine }: { a: MessageView['attachments'][number]; mine: boolean }) {
  // File tin nhắn là riêng tư: dùng URL ký hạn ngắn do BE cấp (<img>/<a> không gửi được Authorization).
  const { t } = useTranslation('messages');
  const href = useFileUrl(a.url);
  if (href === null) return <div className="mt-1.5 text-[12px] opacity-70">{t('chat.attachmentError')}</div>;
  if (a.contentType.startsWith('image/')) {
    return href ? (
      <a href={href} target="_blank" rel="noreferrer" className="mt-1.5 block">
        <img src={href} alt={a.name} className="max-h-56 rounded-xl object-cover" loading="lazy" />
      </a>
    ) : (
      <div className="mt-1.5 h-24 w-40 animate-pulse rounded-xl bg-stone-900/10" />
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      download={a.name}
      className={`mt-1.5 flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[13px] ${mine ? 'bg-white/20' : 'bg-white'}`}
    >
      <MaterialIcon name="attach_file" size={17} />
      <span className="min-w-0 flex-1 truncate">{a.name}</span>
      <span className="flex-none text-[11px] opacity-70">{formatSize(a.size)}</span>
    </a>
  );
}

function Bubble({ m, mine, onRecall, recalling }: { m: MessageView; mine: boolean; onRecall: () => void; recalling: boolean }) {
  const { t } = useTranslation('messages');
  return (
    <div className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}>
      {mine && !m.deleted && (
        <button
          type="button"
          onClick={onRecall}
          disabled={recalling}
          title={t('chat.recall')}
          aria-label={t('chat.recall')}
          className="mr-1 self-center text-stone-400 opacity-0 group-hover:opacity-100 hover:text-red-600 focus:opacity-100 max-md:opacity-100"
        >
          <MaterialIcon name="cancel_schedule_send" size={17} />
        </button>
      )}
      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[14px] ${mine ? 'bg-brand text-white' : 'bg-stone-900/5 text-stone-900'} ${m.deleted ? 'italic opacity-70' : ''}`}>
        {m.content && <p className="break-words whitespace-pre-wrap">{m.content}</p>}
        {m.attachments.map((a) => (
          <ChatAttachment key={a.url} a={a} mine={mine} />
        ))}
        <div className={`mt-0.5 text-[10.5px] ${mine ? 'text-white/75' : 'text-stone-500'}`}>{formatDateTime(m.createdAt)}</div>
      </div>
    </div>
  );
}

export function ChatPanel({ conversationId, conversation, onBack }: { conversationId: string; conversation?: ConversationView; onBack: () => void }) {
  const { t } = useTranslation('messages');
  const { confirm } = usePopup();
  const { user } = useAuth();
  const thread = useThread(conversationId);
  const send = useSendMessage(conversationId);
  const recall = useRecallMessage(conversationId);
  const markRead = useMarkConversationRead();
  const blockToggle = useBlockToggle();
  const delConversation = useDeleteConversation();
  const { upload, uploading, error: uploadError } = useUpload();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const messages = useMemo(() => [...(thread.data?.pages ?? [])].reverse().flatMap((p) => p.data), [thread.data]);
  const lastId = messages[messages.length - 1]?.id;

  // Mở hội thoại / có tin mới khi đang xem -> báo đã đọc.
  const unread = conversation?.unreadCount ?? 0;
  useEffect(() => {
    if (unread > 0 && !markRead.isPending) markRead.mutate(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, unread]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId, conversationId]);

  useEffect(() => {
    setText('');
    setFiles([]);
    setError(null);
  }, [conversationId]);

  const onPickFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    for (const f of Array.from(list)) {
      if (files.length >= 5) {
        setError(t('chat.maxFiles'));
        break;
      }
      try {
        const up = await upload(f, { purpose: 'message_attachment' });
        setFiles((cur) => [...cur, up]);
      } catch {
        /* lỗi đã nằm ở uploadError */
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = () => {
    const content = text.trim() || (files.length ? t('chat.sentFiles', { count: files.length }) : '');
    if (!content || send.isPending || uploading) return;
    setError(null);
    send.mutate(
      { content, attachments: files.map((f) => ({ url: f.url, name: f.name, contentType: f.contentType, size: f.size })) },
      {
        onSuccess: () => {
          setText('');
          setFiles([]);
        },
        onError: (e) => setError(messageErrorText(e)),
      },
    );
  };

  const notFound = thread.error instanceof ApiError && thread.error.status === 404;
  const blocked = conversation?.blockedByMe ?? false;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-[rgba(120,60,20,.08)] px-4 py-3">
        <button type="button" onClick={onBack} aria-label={t('chat.back')} className="md:hidden">
          <MaterialIcon name="arrow_back" size={22} />
        </button>
        <Avatar url={conversation?.other.avatarUrl} name={conversation?.other.name ?? '?'} size={36} className="bg-[#f5dcc8]" />
        <div className="min-w-0 flex-1 truncate text-[15px] font-bold">{conversation?.other.name ?? t('chat.conversation')}</div>
        {conversation && (
          <button
            type="button"
            disabled={delConversation.isPending}
            title={t('chat.deleteConversation')}
            aria-label={t('chat.deleteConversation')}
            onClick={async () => {
              if (!(await confirm({ title: t('chat.deleteConvTitle'), message: t('chat.deleteConvMessage'), tone: 'danger', confirmText: t('chat.deleteConvConfirm') }))) return;
              setError(null);
              delConversation.mutate(conversationId, { onSuccess: onBack, onError: (e) => setError(messageErrorText(e)) });
            }}
            className="grid size-9 flex-none place-items-center rounded-xl border border-[rgba(120,60,20,.12)] text-stone-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <MaterialIcon name="delete" size={18} />
          </button>
        )}
        {conversation && (
          <button
            type="button"
            disabled={blockToggle.isPending}
            onClick={async () => {
              if (!blocked && !(await confirm({ title: t('chat.blockTitle', { name: conversation.other.name }), message: t('chat.blockMessage'), tone: 'danger', confirmText: t('chat.block') }))) return;
              setError(null);
              blockToggle.mutate({ userId: conversation.other.id, block: !blocked }, { onError: (e) => setError(messageErrorText(e)) });
            }}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-[rgba(120,60,20,.12)] px-3 text-[12.5px] font-medium hover:bg-[#fff7f0] disabled:opacity-50"
          >
            <MaterialIcon name={blocked ? 'lock_open' : 'block'} size={16} />
            {blocked ? t('chat.unblock') : t('chat.block')}
          </button>
        )}
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {thread.hasNextPage && (
          <div className="text-center">
            <button
              type="button"
              disabled={thread.isFetchingNextPage}
              onClick={() => {
                const el = listRef.current;
                const prev = el ? el.scrollHeight - el.scrollTop : 0;
                void thread.fetchNextPage().then(() => {
                  requestAnimationFrame(() => {
                    if (el) el.scrollTop = el.scrollHeight - prev;
                  });
                });
              }}
              className="rounded-full border border-[rgba(120,60,20,.12)] bg-white px-4 py-1.5 text-[12.5px] font-medium hover:bg-[#fff7f0] disabled:opacity-50"
            >
              {thread.isFetchingNextPage ? t('chat.loading') : t('chat.loadOlder')}
            </button>
          </div>
        )}
        {thread.isPending && <p className="py-10 text-center text-stone-400">{t('chat.loadingMessages')}</p>}
        {notFound && <p className="py-10 text-center text-stone-500">{t('chat.notFound')}</p>}
        {thread.isError && !notFound && <p className="py-10 text-center text-red-600">{messageErrorText(thread.error)}</p>}
        {thread.isSuccess && messages.length === 0 && <p className="py-10 text-center text-stone-500">{t('chat.noMessages')}</p>}
        {messages.map((m) => (
          <Bubble
            key={m.id}
            m={m}
            mine={m.senderId === user?.id}
            recalling={recall.isPending}
            onRecall={async () => {
              if (await confirm({ title: t('chat.recallTitle'), message: t('chat.recallMessage'), tone: 'danger', confirmText: t('chat.recallConfirm') })) {
                setError(null);
                recall.mutate(m.id, { onError: (e) => setError(messageErrorText(e)) });
              }
            }}
          />
        ))}
      </div>

      {(error || uploadError) && (
        <div role="alert" className="mx-4 mb-2 rounded-xl bg-red-50 px-4 py-2 text-[13px] font-medium text-red-600">
          {error ?? uploadError}
        </div>
      )}
      {blocked ? (
        <p className="border-t border-[rgba(120,60,20,.08)] px-4 py-3 text-center text-[13px] text-stone-500">{t('chat.youBlocked')}</p>
      ) : (
        <div className="border-t border-[rgba(120,60,20,.08)] px-3 py-3">
          {files.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {files.map((f) => (
                <span key={f.key} className="flex max-w-[200px] items-center gap-1.5 rounded-lg bg-stone-900/5 px-2 py-1 text-[12px]">
                  <MaterialIcon name={f.contentType.startsWith('image/') ? 'image' : 'attach_file'} size={15} />
                  <span className="truncate">{f.name}</span>
                  <button type="button" aria-label={t('chat.removeFile', { name: f.name })} onClick={() => setFiles((cur) => cur.filter((x) => x.key !== f.key))}>
                    <MaterialIcon name="close" size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => void onPickFiles(e.target.files)} />
            <button
              type="button"
              disabled={uploading || files.length >= 5}
              onClick={() => fileRef.current?.click()}
              aria-label={t('chat.attach')}
              title={t('chat.attachTitle')}
              className="grid size-10 flex-none place-items-center rounded-xl border border-[rgba(120,60,20,.12)] bg-white hover:bg-[#fff7f0] disabled:opacity-50"
            >
              <MaterialIcon name={uploading ? 'progress_activity' : 'attach_file'} size={20} />
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              maxLength={2000}
              rows={1}
              placeholder={t('chat.placeholder')}
              className="max-h-32 min-h-10 min-w-0 flex-1 resize-none rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3 py-2 text-[14px] outline-0 focus:border-brand"
            />
            <button
              type="button"
              onClick={submit}
              disabled={send.isPending || uploading || (!text.trim() && files.length === 0)}
              aria-label={t('chat.send')}
              className="grid size-10 flex-none place-items-center rounded-xl bg-brand text-white disabled:opacity-50"
            >
              <MaterialIcon name="send" size={19} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
