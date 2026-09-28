export interface Story {
  id: string;
  name: string;
  role: string;
  text: string;
  avatar: string;
}

/** Nội dung tĩnh của mục "Câu chuyện từ cộng đồng" (chưa có API — xem PLAN.md). */
export const STORIES: Story[] = [
  {
    id: 'ha',
    name: 'Nguyễn Thu Hà',
    role: 'Freelancer',
    text: 'Nhờ SofinHub, mình đã học được rất nhiều kỹ năng mới và kết nối với những người cùng chí hướng. Đây là nơi tuyệt vời để phát triển bản thân!',
    avatar: '/images/stories/ha.webp',
  },
  {
    id: 'quan',
    name: 'Trần Minh Quân',
    role: 'Chủ doanh nghiệp',
    text: 'Tôi đã tạo cộng đồng riêng cho đội ngũ của mình. Công cụ rất dễ dùng và hỗ trợ tuyệt vời. Giúp chúng tôi học nhanh hơn và gắn kết hơn.',
    avatar: '/images/stories/quan.webp',
  },
  {
    id: 'anh',
    name: 'Lê Mai Anh',
    role: 'Content Creator',
    text: 'Chất lượng khóa học rất thực tế, giảng viên tâm huyết và cộng đồng luôn sẵn sàng hỗ trợ. Rất đáng để tham gia!',
    avatar: '/images/stories/anh.webp',
  },
  {
    id: 'huy',
    name: 'Phạm Quốc Huy',
    role: 'Học viên',
    text: 'Giao diện đẹp, dễ sử dụng, nội dung đa dạng. Mình đã áp dụng ngay những gì học được vào công việc và thấy hiệu quả rõ rệt.',
    avatar: '/images/stories/huy.webp',
  },
  {
    id: 'linh',
    name: 'Đỗ Khánh Linh',
    role: 'Product Designer',
    text: 'Mỗi tuần đều có buổi chia sẻ trực tuyến, mình học được cách làm việc từ những người đi trước. Rất đáng giá.',
    avatar: '/images/stories/linh.webp',
  },
];
