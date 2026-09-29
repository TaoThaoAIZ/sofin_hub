export interface CommunityEvent {
  id: string;
  courseId: string;
  hostId: string;
  title: string;
  description: string;
  /** ISO 8601 datetime. */
  startAt: string;
  timezone: string;
  meetingLink?: string;
  capacity?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CommunityEventView extends CommunityEvent {
  rsvpCount: number;
  viewerRsvped: boolean;
  isPast: boolean;
}
