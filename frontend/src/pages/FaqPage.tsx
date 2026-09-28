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
        a: 'Bấm "Đăng ký" ở góc phải Header hoặc khi bấm "Tham gia ngay" ở một khóa học mà chưa đăng nhập. Bạn cần đọc hết Điều khoản sử dụng và Chính sách bảo mật (cuộn tới cuối trang) trước khi được tick đồng ý và tạo tài khoản.',
      },
      {
        q: 'Mật khẩu cần đáp ứng yêu cầu gì?',
        a: 'Tối thiểu 8 ký tự, có ít nhất 1 chữ in hoa và 1 ký tự đặc biệt (vd. Matkhau@123).',
      },
      {
        q: 'Tôi quên mật khẩu thì làm sao?',
        a: 'Tính năng khôi phục mật khẩu đang được phát triển. Trong lúc chờ, vui lòng liên hệ đội ngũ hỗ trợ qua email để được cấp lại quyền truy cập.',
      },
      {
        q: 'Tôi có thể đăng nhập bằng Google/Facebook không?',
        a: 'Chưa hỗ trợ — nút Google/Facebook trên trang Đăng nhập/Đăng ký hiện là "sắp ra mắt". Vui lòng dùng email + mật khẩu.',
      },
      {
        q: 'Làm sao để đăng xuất?',
        a: 'Bấm vào avatar/tên của bạn ở góc phải Header, chọn "Đăng xuất" trong menu hiện ra.',
      },
    ],
  },
  {
    title: 'Khóa học',
    items: [
      {
        q: 'Làm sao để tham gia một khóa học?',
        a: 'Vào trang chi tiết khóa học, bấm "Tham gia ngay". Nếu chưa đăng nhập, bạn sẽ được đưa sang trang đăng nhập/đăng ký rồi tự động quay lại đúng khóa học đó.',
      },
      {
        q: 'Khóa học có miễn phí không?',
        a: 'Tùy khóa học — một số khóa miễn phí hoàn toàn, số khác tính phí theo tháng hoặc có thời gian dùng thử. Giá được hiển thị rõ ở trang chi tiết từng khóa.',
      },
      {
        q: 'Làm sao để rời khỏi khóa học đã tham gia?',
        a: 'Vào lại trang chi tiết khóa học, bấm nút "Đã tham gia" một lần nữa để rời.',
      },
      {
        q: 'Tôi có thể học trên điện thoại không?',
        a: 'Có. Giao diện SofinHub responsive, dùng được trên máy tính, máy tính bảng và điện thoại qua trình duyệt.',
      },
    ],
  },
  {
    title: 'Thanh toán & Gói thành viên',
    items: [
      {
        q: 'Thanh toán khóa học có phí như thế nào?',
        a: 'Tính năng thanh toán đang được phát triển. Khi ra mắt, các khóa học có phí sẽ tính theo gói tháng, có thể kèm thời gian dùng thử miễn phí trước khi bắt đầu tính phí.',
      },
      {
        q: 'Tôi có thể hủy gói bất kỳ lúc nào không?',
        a: 'Đây là định hướng khi ra mắt thanh toán: hủy bất kỳ lúc nào, quyền truy cập vẫn còn tới hết chu kỳ đã trả, không tự động bị trừ phí thêm sau khi hủy.',
      },
      {
        q: 'Có hoàn tiền không?',
        a: 'Chính sách hoàn tiền cụ thể sẽ được công bố khi tính năng thanh toán chính thức ra mắt.',
      },
    ],
  },
  {
    title: 'Cộng đồng',
    items: [
      {
        q: 'Tôi có thể tạo cộng đồng riêng của mình không?',
        a: 'Tính năng "Tạo cộng đồng" đang được phát triển. Khi ra mắt, bất kỳ tài khoản nào cũng có thể tạo cộng đồng, mời quản trị viên và mở khóa học riêng trong cộng đồng của mình.',
      },
    ],
  },
  {
    title: 'Khác',
    items: [
      {
        q: 'Làm sao để liên hệ hỗ trợ?',
        a: 'Gửi email tới support@sofinhub.com, đội ngũ SofinHub sẽ phản hồi sớm nhất có thể.',
      },
      {
        q: 'Dữ liệu cá nhân của tôi có được bảo mật không?',
        a: 'Có — xem chi tiết cách chúng tôi thu thập, sử dụng và bảo vệ dữ liệu tại trang Chính sách bảo mật.',
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
          <a
            href="mailto:support@sofinhub.com"
            className="bg-brand-gradient shadow-brand flex h-11 items-center rounded-2xl px-5 text-sm font-semibold text-white hover:brightness-[1.06]"
          >
            Liên hệ hỗ trợ
          </a>
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
