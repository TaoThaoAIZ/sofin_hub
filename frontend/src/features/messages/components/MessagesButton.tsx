import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { CountBadge } from '../../notifications/components/NotificationBell';
import { useMessagesContext } from '../MessagesProvider';

/** Icon tin nhắn có badge chưa đọc, dẫn tới /messages. */
export function MessagesButton({ variant = 'topbar' }: { variant?: 'topbar' | 'header' }) {
  const { unreadCount } = useMessagesContext();
  return (
    <Link
      to="/messages"
      aria-label={unreadCount > 0 ? `Tin nhắn (${unreadCount} chưa đọc)` : 'Tin nhắn'}
      className={`relative ${variant === 'header' ? 'glass grid size-10 place-items-center rounded-full' : 'grid place-items-center'}`}
    >
      <MaterialIcon name="forum" size={variant === 'header' ? 22 : 24} />
      <CountBadge count={unreadCount} />
    </Link>
  );
}
