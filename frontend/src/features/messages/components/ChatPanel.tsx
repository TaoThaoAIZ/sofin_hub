import { useEffect, useMemo, useRef, useState } from 'react';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError, resolveApiPath } from '../../../lib/api';
import { formatDateTime } from '../../../lib/datetime';
import { useAuth } from '../../auth/AuthContext';
import { useUpload, type UploadedFile } from '../../uploads/useUpload';
import { messageErrorText, useBlockToggle, useMarkConversationRead, useRecallMessage, useSendMessage, useThread } from '../queries';
import type { ConversationView, MessageView } from '../types';

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function Bubble({ m, mine, onRecall, recalling }: { m: MessageView; mine: boolean; onRecall: () => void; recalling: boolean }) {
  return (
    <div className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}>
      {mine && !m.deleted && (
        <button
          type="button"
          onClick={onRecall}
          disabled={recalling}
          title="Thu hồi tin nhắn"
          aria-label="Thu hồi tin nhắn"
          className="mr-1 self-center text-stone-400 opacity-0 group-hover:opacity-100 hover:text-red-600 focus:opacity-100 max-md:opacity-100"
        >
          <MaterialIcon name="undo" size={17} />
        </button>
      )}
      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[14px] ${mine ? 'bg-brand text-white' : 'bg-stone-900/5 text-stone-900'} ${m.deleted ? 'italic opacity-70' : ''}`}>
        {m.content && <p className="break-words whitespace-pre-wrap">{m.content}</p>}
        {m.attachments.map((a) =>
          a.contentType.startsWith('image/') ? (
            <a key={a.url} href={resolveApiPath(a.url)} target="_blank" rel="noreferrer" className="mt-1.5 block">
              <img src={resolveApiPath(a.url)} alt={a.name} className="max-h-56 rounded-xl object-cover" loading="lazy" />
            </a>
          ) : (
            <a
              key={a.url}
              href={resolveApiPath(a.url)}
              target="_blank"
              rel="noreferrer"
              download={a.name}
              className={`mt-1.5 flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[13px] ${mine ? 'bg-white/20' : 'bg-white'}`}
            >
              <MaterialIcon name="attach_file" size={17} />
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              <span className="flex-none text-[11px] opacity-70">{formatSize(a.size)}</span>
            </a>
          ),
        )}
        <div className={`mt-0.5 text-[10.5px] ${mine ? 'text-white/75' : 'text-stone-500'}`}>{formatDateTime(m.createdAt)}</div>
      </div>
    </div>
  );
}

export function ChatPanel({ conversationId, conversation, onBack }: { conversationId: string; conversation?: ConversationView; onBack: () => void }) {
  const { user } = useAuth();
  const thread = useThread(conversationId);
  const send = useSendMessage(conversationId);
  const recall = useRecallMessage(conversationId);
  const markRead = useMarkConversationRead();
  const blockToggle = useBlockToggle();
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
        setError('Chỉ đính kèm tối đa 5 tệp mỗi tin nhắn');
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
    const content = text.trim() || (files.length ? `Đã gửi ${files.length} tệp đính kèm` : '');
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
        <button type="button" onClick={onBack} aria-label="Quay lại" className="md:hidden">
          <MaterialIcon name="arrow_back" size={22} />
        </button>
        <span className="grid size-9 flex-none place-items-center rounded-full bg-[#f5dcc8] text-[13px] font-bold">
          {(conversation?.other.name ?? '?').charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 truncate text-[15px] font-bold">{conversation?.other.name ?? 'Cuộc trò chuyện'}</div>
        {conversation && (
          <button
            type="button"
            disabled={blockToggle.isPending}
            onClick={() => {
              if (!blocked && !window.confirm(`Chặn ${conversation.other.name}? Hai bên sẽ không nhắn tin cho nhau được nữa.`)) return;
              setError(null);
              blockToggle.mutate({ userId: conversation.other.id, block: !blocked }, { onError: (e) => setError(messageErrorText(e)) });
            }}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-[rgba(120,60,20,.12)] px-3 text-[12.5px] font-medium hover:bg-[#fff7f0] disabled:opacity-50"
          >
            <MaterialIcon name={blocked ? 'lock_open' : 'block'} size={16} />
            {blocked ? 'Bỏ chặn' : 'Chặn'}
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
              {thread.isFetchingNextPage ? 'Đang tải…' : 'Tải tin cũ hơn'}
            </button>
          </div>
        )}
        {thread.isPending && <p className="py-10 text-center text-stone-400">Đang tải tin nhắn…</p>}
        {notFound && <p className="py-10 text-center text-stone-500">Không tìm thấy cuộc trò chuyện này.</p>}
        {thread.isError && !notFound && <p className="py-10 text-center text-red-600">{messageErrorText(thread.error)}</p>}
        {thread.isSuccess && messages.length === 0 && <p className="py-10 text-center text-stone-500">Chưa có tin nhắn nào. Hãy gửi lời chào!</p>}
        {messages.map((m) => (
          <Bubble
            key={m.id}
            m={m}
            mine={m.senderId === user?.id}
            recalling={recall.isPending}
            onRecall={() => {
              if (window.confirm('Thu hồi tin nhắn này? Nội dung sẽ bị xóa với cả hai bên.')) {
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
        <p className="border-t border-[rgba(120,60,20,.08)] px-4 py-3 text-center text-[13px] text-stone-500">Bạn đã chặn người này. Bỏ chặn để tiếp tục nhắn tin.</p>
      ) : (
        <div className="border-t border-[rgba(120,60,20,.08)] px-3 py-3">
          {files.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {files.map((f) => (
                <span key={f.key} className="flex max-w-[200px] items-center gap-1.5 rounded-lg bg-stone-900/5 px-2 py-1 text-[12px]">
                  <MaterialIcon name={f.contentType.startsWith('image/') ? 'image' : 'attach_file'} size={15} />
                  <span className="truncate">{f.name}</span>
                  <button type="button" aria-label={`Bỏ ${f.name}`} onClick={() => setFiles((cur) => cur.filter((x) => x.key !== f.key))}>
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
              aria-label="Đính kèm tệp"
              title="Đính kèm ảnh / tệp"
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
              placeholder="Nhập tin nhắn…"
              className="max-h-32 min-h-10 min-w-0 flex-1 resize-none rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3 py-2 text-[14px] outline-0 focus:border-brand"
            />
            <button
              type="button"
              onClick={submit}
              disabled={send.isPending || uploading || (!text.trim() && files.length === 0)}
              aria-label="Gửi"
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
