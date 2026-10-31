import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ThemedImg } from '../../../components/ui/ThemedImg';
import { CountBadge, HEADER_ICON_BTN } from '../../notifications/components/NotificationBell';
import { useMessagesContext } from '../MessagesProvider';

/** Icon tin nhắn có badge chưa đọc, dẫn tới /messages. */
export function MessagesButton({ variant = 'topbar' }: { variant?: 'topbar' | 'header' }) {
  const { t } = useTranslation('messages');
  const { unreadCount } = useMessagesContext();
  return (
    <Link
      to="/messages"
      aria-label={unreadCount > 0 ? t('button.labelUnread', { count: unreadCount }) : t('button.label')}
      className={`relative ${variant === 'header' ? HEADER_ICON_BTN : 'grid place-items-center'}`}
    >
      {variant === 'header' ? <ThemedImg name="messenger" className="size-[28px]" /> : <MaterialIcon name="forum" size={24} />}
      <CountBadge count={unreadCount} large={variant === 'header'} />
    </Link>
  );
}
