import { UserDetailView } from '../../features/admin/pages/UserDetailView';
import { UsersBanned, UsersList, UsersRestricted } from '../../features/admin/pages/UsersList';

/** /admin/users, /restricted, /banned, /:id */
export const AdminUsersPage = () => <UsersList />;
export const AdminUsersRestrictedPage = () => <UsersRestricted />;
export const AdminUsersBannedPage = () => <UsersBanned />;
export const AdminUserDetailPage = () => <UserDetailView />;
