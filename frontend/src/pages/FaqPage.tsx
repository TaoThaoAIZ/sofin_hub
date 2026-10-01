import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { SectionTitle } from '../components/ui/SectionTitle';

interface FaqItem {
  q: string;
  a: string;
}

interface FaqCategory {
  title: string;
  items: FaqItem[];
}

const CATEGORIES: FaqCategory[] = [
  {
    title: 'Tài khoản & Đăng nhập',
    items: [
      {
        q: 'Làm sao để đăng ký tài khoản?',
        a: 'Bấm "Đăng ký", hoặc bấm "Tham gia ngay" ở một cộng đồng khi chưa đăng nhập. Bạn cần đọc hết Điều khoản sử dụng và Chính sách bảo mật (cuộn tới cuối trang) trước khi tick đồng ý. Sau khi đăng ký, hệ thống gửi email xác minh địa chỉ của bạn.',
      },
      {
        q: 'Mật khẩu cần đáp ứng yêu cầu gì?',
        a: 'Tối thiểu 8 ký tự, có ít nhất 1 chữ in hoa và 1 ký tự đặc biệt (vd. Matkhau@123).',
      },
      {
        q: 'Tôi quên mật khẩu thì làm sao?',
        a: 'Ở trang Đăng nhập, bấm "Quên mật khẩu" và nhập email. Chúng tôi gửi liên kết đặt lại mật khẩu qua email; liên kết có thời hạn và chỉ dùng được một lần. Bạn cũng có thể đổi mật khẩu bất kỳ lúc nào trong Cài đặt tài khoản.',
      },
      {
        q: 'Tôi có thể đăng nhập bằng Google/Facebook không?',
        a: 'Chưa hỗ trợ. Hiện bạn đăng nhập bằng email và mật khẩu.',
      },
      {
        q: 'Làm sao để đăng xuất, hoặc quản lý thông tin cá nhân?',
        a: 'Bấm vào tên của bạn ở góc phải Header: tại đây có Hồ sơ, Cài đặt tài khoản (đổi thông tin, mật khẩu, thiết bị đang đăng nhập), Thông báo, Tin nhắn, Gói & thanh toán và nút "Đăng xuất".',
      },
    ],
  },
  {
    title: 'Cộng đồng',
    items: [
      {
        q: 'Làm sao để tham gia một cộng đồng?',
        a: 'Vào trang chi tiết cộng đồng và bấm "Tham gia ngay". Nếu chưa đăng nhập, bạn được đưa sang trang đăng nhập rồi quay lại đúng cộng đồng đó. Cộng đồng có phí sẽ chuyển bạn tới trang thanh toán; cộng đồng riêng tư cần quản trị viên duyệt yêu cầu của bạn.',
      },
      {
        q: 'Trong một cộng đồng tôi làm được những gì?',
        a: 'Đăng bài và bình luận ở trang Thảo luận, học trong Lớp học (module, bài học, theo dõi tiến độ), xem Lịch sự kiện, xem Thành viên và Bảng xếp hạng điểm, và để lại đánh giá cho cộng đồng.',
      },
      {
        q: 'Tôi có thể tạo cộng đồng riêng của mình không?',
        a: 'Có. Bấm "Tạo cộng đồng" ở Header, điền tên, mô tả, danh mục, chế độ công khai/riêng tư và giá (miễn phí hoặc có phí). Bạn trở thành chủ cộng đồng, có thể soạn Lớp học, tạo sự kiện, kiểm duyệt nội dung, mời quản trị viên/điều hành viên và xem doanh thu.',
      },
      {
        q: 'Làm sao để rời khỏi cộng đồng?',
        a: 'Vào lại trang chi tiết cộng đồng và bấm nút "Đã tham gia" để rời. Với cộng đồng có phí, khi rời bạn mất truy cập ngay và gói tự động hủy vào cuối kỳ (không bị tính phí kỳ sau, tiền kỳ đã trả không hoàn); trong kỳ đã trả bạn vào lại không mất thêm phí. Xem trạng thái ở mục "Gói & thanh toán".',
      },
      {
        q: 'Nội dung hoặc thành viên vi phạm thì báo cáo ở đâu?',
        a: 'Dùng chức năng "Báo cáo" trên bài viết/bình luận. Quản trị viên cộng đồng xử lý ở trang Kiểm duyệt, và đội ngũ quản trị nền tảng có thể can thiệp khi cần.',
      },
    ],
  },
  {
    title: 'Thanh toán & Gói thành viên',
    items: [
      {
        q: 'Thanh toán cộng đồng có phí như thế nào?',
        a: 'Cộng đồng có phí tính theo gói tháng. Bạn thanh toán ở trang thanh toán của cộng đồng đó; giá được hiển thị rõ ở trang chi tiết. Các giao dịch và gói của bạn nằm ở mục "Gói & thanh toán".',
      },
      {
        q: 'Có được dùng thử miễn phí không?',
        a: 'Cộng đồng có phí áp dụng thời gian dùng thử miễn phí; số ngày cụ thể được hiển thị ở trang chi tiết cộng đồng và có thể thay đổi theo cấu hình của nền tảng.',
      },
      {
        q: 'Tôi có thể hủy gói bất kỳ lúc nào không?',
        a: 'Có. Bạn hủy trong "Gói & thanh toán"; quyền truy cập vẫn còn tới hết chu kỳ đã trả và sẽ không bị trừ phí thêm.',
      },
      {
        q: 'Có hoàn tiền không?',
        a: 'Có, trong thời hạn hoàn tiền của nền tảng. Hãy liên hệ hỗ trợ kèm thông tin giao dịch; yêu cầu được xem xét và hóa đơn sẽ hiển thị trạng thái "Đã hoàn tiền" khi hoàn tất.',
      },
    ],
  },
  {
    title: 'Hỗ trợ',
    items: [
      {
        q: 'Làm sao để liên hệ hỗ trợ?',
        a: 'Gửi biểu mẫu ở trang Liên hệ hoặc email tới support@sofinhub.com. Yêu cầu của bạn được ghi nhận thành phiếu hỗ trợ và đội ngũ phản hồi qua email.',
      },
      {
        q: 'Dữ liệu cá nhân của tôi có được bảo mật không?',
        a: 'Xem chi tiết cách chúng tôi thu thập, sử dụng và bảo vệ dữ liệu tại trang Chính sách bảo mật.',
      },
    ],
  },
];

export function FaqPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="mx-auto max-w-[860px] px-4 pt-10 pb-16 md:px-10">
        <div className="text-center">
          <h1 className="m-0 text-[clamp(28px,3.4vw,44px)] font-extrabold tracking-[-1px]">Câu hỏi thường gặp</h1>
          <p className="mt-3 text-base text-stone-600 text-pretty">
            Chưa tìm thấy câu trả lời? Liên hệ chúng tôi qua{' '}
            <a href="mailto:support@sofinhub.com" className="font-semibold underline">
              support@sofinhub.com
            </a>
            .
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-8">
          {CATEGORIES.map((cat) => (
            <section key={cat.title} className="flex flex-col gap-3">
              <SectionTitle size="sm">{cat.title}</SectionTitle>
              <div className="flex flex-col gap-2.5">
                {cat.items.map((item) => (
                  <FaqRow key={item.q} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="glass mt-10 flex flex-wrap items-center justify-between gap-4 rounded-[22px] p-6 text-center sm:text-left">
          <div>
            <div className="text-base font-bold">Vẫn còn thắc mắc?</div>
            <div className="mt-1 text-sm text-stone-600">Đội ngũ SofinHub luôn sẵn sàng hỗ trợ bạn.</div>
          </div>
          <Link
            to="/contact"
            className="bg-brand-gradient shadow-brand flex h-11 items-center rounded-2xl px-5 text-sm font-semibold text-white hover:brightness-[1.06]"
          >
            Liên hệ hỗ trợ
          </Link>
        </div>

        <p className="mt-6 text-center text-sm text-stone-500">
          Xem thêm{' '}
          <Link to="/terms" className="font-semibold underline">
            Điều khoản sử dụng
          </Link>{' '}
          và{' '}
          <Link to="/privacy" className="font-semibold underline">
            Chính sách bảo mật
          </Link>
          .
        </p>
      </div>

      <Footer />
    </div>
  );
}

function FaqRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass rounded-[16px] px-5 py-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 border-0 bg-transparent p-0 text-left"
      >
        <span className="text-[15px] font-bold">{item.q}</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`flex-none text-stone-500 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="mt-2.5 text-sm leading-[1.6] text-stone-600 text-pretty">{item.a}</div>}
    </div>
  );
}
