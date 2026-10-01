export interface CommunityEvent {
  id: string;
  communityId: string;
  /** @deprecated alias của communityId (tương thích JSON cũ) — repository luôn điền. */
  courseId?: string;
  hostId: string;
  title: string;
  description: string;
  /** ISO 8601 datetime. */
  startAt: string;
  timezone: string;
  meetingLink?: string;
  capacity?: number;
  /** Có giá trị khi Platform Admin đã hủy sự kiện (vẫn hiển thị, không RSVP được). */
  cancelledAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CommunityEventView extends CommunityEvent {
  rsvpCount: number;
  viewerRsvped: boolean;
  isPast: boolean;
}
