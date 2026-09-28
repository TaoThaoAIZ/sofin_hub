import { Link } from 'react-router-dom';
import { LegalLayout, LegalSection } from '../components/layout/LegalLayout';
import { markPrivacyRead } from '../features/auth/legalConsent';

export function PrivacyPage() {
  return (
    <LegalLayout title="Chính sách bảo mật" updatedAt="28/09/2026" onRead={markPrivacyRead}>
      <p className="m-0 text-[15px] leading-[1.75] text-stone-600 text-pretty">
        Chính sách này giải thích SofinHub thu thập, sử dụng, chia sẻ và bảo vệ thông tin cá nhân của bạn như thế nào
        khi bạn sử dụng website, khóa học và cộng đồng của chúng tôi.
      </p>

      <LegalSection title="1. Thông tin chúng tôi thu thập">
        <ul className="m-0 list-disc pl-5">
          <li><b className="text-stone-800">Thông tin tài khoản:</b> họ tên, email, mật khẩu (được mã hóa/hash, không lưu ở dạng thô).</li>
          <li><b className="text-stone-800">Thông tin sử dụng:</b> khóa học đã tham gia, tiến độ học, tương tác trong cộng đồng.</li>
          <li><b className="text-stone-800">Thông tin thiết bị:</b> địa chỉ IP, loại trình duyệt, thời gian truy cập, phục vụ bảo mật và cải thiện dịch vụ.</li>
          <li><b className="text-stone-800">Thông tin thanh toán:</b> được xử lý bởi đối tác cổng thanh toán; SofinHub không lưu trữ số thẻ đầy đủ.</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Mục đích sử dụng thông tin">
        <ul className="m-0 list-disc pl-5">
          <li>Tạo và duy trì tài khoản, xác thực đăng nhập, khôi phục mật khẩu;</li>
          <li>Cung cấp, cá nhân hóa và cải thiện nội dung khóa học/cộng đồng;</li>
          <li>Xử lý thanh toán, gói thành viên và thông báo liên quan;</li>
          <li>Gửi thông tin cập nhật, bản tin (nếu bạn đăng ký nhận) và hỗ trợ khách hàng;</li>
          <li>Phát hiện, ngăn chặn gian lận, lạm dụng và đảm bảo an toàn hệ thống.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Cookie và công nghệ theo dõi">
        <p>
          Chúng tôi dùng cookie và các công nghệ tương tự để duy trì phiên đăng nhập, ghi nhớ tùy chọn của bạn và
          phân tích lưu lượng truy cập. Bạn có thể tắt cookie trong trình duyệt, tuy nhiên một số tính năng (như giữ
          đăng nhập) có thể không hoạt động đầy đủ.
        </p>
      </LegalSection>

      <LegalSection title="4. Chia sẻ thông tin với bên thứ ba">
        <p>Chúng tôi không bán thông tin cá nhân của bạn. Thông tin chỉ được chia sẻ trong các trường hợp:</p>
        <ul className="m-0 list-disc pl-5">
          <li>Với đối tác xử lý thanh toán để hoàn tất giao dịch;</li>
          <li>Với nhà cung cấp hạ tầng kỹ thuật (lưu trữ, gửi email) theo hợp đồng bảo mật;</li>
          <li>Khi pháp luật yêu cầu hoặc để bảo vệ quyền lợi hợp pháp của SofinHub và người dùng.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Bảo mật dữ liệu">
        <p>
          Mật khẩu được hash trước khi lưu trữ, kết nối được mã hóa qua HTTPS, phiên đăng nhập dùng access token
          ngắn hạn kèm cơ chế làm mới token an toàn. Dù áp dụng các biện pháp hợp lý, không có hệ thống nào an toàn
          tuyệt đối — vui lòng bảo vệ mật khẩu và thông báo cho chúng tôi nếu nghi ngờ tài khoản bị xâm nhập.
        </p>
      </LegalSection>

      <LegalSection title="6. Lưu trữ dữ liệu">
        <p>
          Chúng tôi lưu trữ thông tin tài khoản trong suốt thời gian bạn còn sử dụng Dịch vụ. Khi bạn yêu cầu xóa tài
          khoản, dữ liệu cá nhân sẽ được xóa hoặc ẩn danh hóa trong thời gian hợp lý, trừ khi pháp luật yêu cầu lưu
          giữ lâu hơn.
        </p>
      </LegalSection>

      <LegalSection title="7. Quyền của bạn">
        <ul className="m-0 list-disc pl-5">
          <li>Truy cập và xem lại thông tin cá nhân đã cung cấp;</li>
          <li>Yêu cầu chỉnh sửa thông tin không chính xác;</li>
          <li>Yêu cầu xóa tài khoản và dữ liệu liên quan;</li>
          <li>Rút lại sự đồng ý nhận bản tin/email marketing bất kỳ lúc nào.</li>
        </ul>
        <p>
          Để thực hiện các quyền trên, hãy liên hệ theo mục "Liên hệ" bên dưới.
        </p>
      </LegalSection>

      <LegalSection title="8. Đối tượng sử dụng">
        <p>
          Dịch vụ không hướng đến trẻ em dưới 13 tuổi. Nếu bạn phát hiện một tài khoản của trẻ em dưới 13 tuổi được
          tạo mà không có sự đồng ý của phụ huynh, vui lòng liên hệ để chúng tôi xử lý.
        </p>
      </LegalSection>

      <LegalSection title="9. Thay đổi chính sách">
        <p>
          Chính sách này có thể được cập nhật theo thời gian. Ngày cập nhật gần nhất được hiển thị ở đầu trang. Chúng
          tôi khuyến khích bạn xem lại định kỳ.
        </p>
      </LegalSection>

      <LegalSection title="10. Liên hệ">
        <p>
          Mọi câu hỏi về Chính sách bảo mật, vui lòng liên hệ{' '}
          <a href="mailto:support@sofinhub.com" className="font-semibold underline">
            support@sofinhub.com
          </a>
          . Xem thêm{' '}
          <Link to="/terms" className="font-semibold underline">
            Điều khoản sử dụng
          </Link>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
