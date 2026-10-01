import { CommunitiesList } from '../../features/admin/pages/CommunitiesList';
import { CommunityReview, CommunitySuspended, CommunityTrash } from '../../features/admin/pages/CommunitiesQueues';
import { CommunityDetailView } from '../../features/admin/pages/CommunityDetailView';

/** /admin/communities, /review, /suspended, /trash, /:id */
export const AdminCommunitiesPage = () => <CommunitiesList />;
export const AdminCommunityReviewPage = () => <CommunityReview />;
export const AdminCommunitySuspendedPage = () => <CommunitySuspended />;
export const AdminCommunityTrashPage = () => <CommunityTrash />;
export const AdminCommunityDetailPage = () => <CommunityDetailView />;
