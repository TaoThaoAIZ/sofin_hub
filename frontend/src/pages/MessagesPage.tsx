import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { RequireLogin } from '../components/layout/RequireLogin';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { formatRelative } from '../lib/datetime';
import { useAuth } from '../features/auth/AuthContext';
import { BlockedUsersDialog } from '../features/messages/components/BlockedUsersDialog';
import { ChatPanel } from '../features/messages/components/ChatPanel';
import { useConversations } from '../features/messages/queries';

function MessagesInner() {
  const { t } = useTranslation('messages');
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const conversations = useConversations();
  const [showBlocks, setShowBlocks] = useState(false);
  const current = conversations.data?.find((c) => c.id === id);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="mx-auto mt-4 h-[calc(100vh-110px)] min-h-[480px] max-w-[1100px] px-4 pb-4 md:px-0">
        <div className="glass grid h-full grid-cols-1 overflow-hidden rounded-3xl md:grid-cols-[320px_minmax(0,1fr)]">
          <aside className={`min-h-0 flex-col border-r border-[rgba(120,60,20,.08)] ${id ? 'hidden md:flex' : 'flex'}`}>
            <div className="flex items-center justify-between px-4 py-3.5">
              <h1 className="text-lg font-extrabold">{t('page.title')}</h1>
              <button
                type="button"
                onClick={() => setShowBlocks(true)}
                title={t('blocked.title')}
                aria-label={t('blocked.title')}
                className="grid size-9 place-items-center rounded-xl text-stone-600 hover:bg-stone-900/5"
              >
                <MaterialIcon name="block" size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {conversations.isPending && <p className="py-10 text-center text-stone-400">{t('page.loading')}</p>}
              {conversations.isError && <p className="py-10 text-center text-red-600">{t('page.loadError')}</p>}
              {conversations.data?.length === 0 && (
                <p className="px-6 py-10 text-center text-[13.5px] text-stone-500">
                  {t('page.empty')}
                </p>
              )}
              {conversations.data?.map((c) => {
                const mine = c.lastMessage?.senderId === user?.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/messages/${c.id}`)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#fff7f0] ${c.id === id ? 'bg-brand/10' : ''}`}
                  >
                    <span className="grid size-11 flex-none place-items-center rounded-full bg-[#f5dcc8] text-[14px] font-bold">
                      {c.other.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={`min-w-0 flex-1 truncate text-[14px] ${c.unreadCount > 0 ? 'font-bold' : 'font-semibold'}`}>{c.other.name}</span>
                        <span className="flex-none text-[11px] text-stone-400">{formatRelative(c.lastMessageAt)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={`min-w-0 flex-1 truncate text-[12.5px] ${c.unreadCount > 0 ? 'font-semibold text-stone-800' : 'text-stone-500'}`}>
                          {c.blockedByMe
                            ? t('page.blocked')
                            : c.lastMessage
                              ? `${mine ? t('page.you') : ''}${c.lastMessage.content}`
                              : t('page.noMessages')}
                        </span>
                        {c.unreadCount > 0 && (
                          <span className="grid min-w-[20px] flex-none place-items-center rounded-full bg-brand px-1.5 text-[11px] leading-5 font-bold text-white">
                            {c.unreadCount > 99 ? '99+' : c.unreadCount}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className={`min-h-0 ${id ? 'block' : 'hidden md:block'}`}>
            {id ? (
              <ChatPanel key={id} conversationId={id} conversation={current} onBack={() => navigate('/messages')} />
            ) : (
              <div className="grid h-full place-items-center text-center text-stone-500">
                <div>
                  <MaterialIcon name="forum" size={48} color="#d6d3d1" />
                  <p className="mt-2 text-sm">{t('page.selectPrompt')}</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
      {showBlocks && <BlockedUsersDialog onClose={() => setShowBlocks(false)} />}
    </div>
  );
}

export function MessagesPage() {
  return (
    <RequireLogin>
      <MessagesInner />
    </RequireLogin>
  );
}
