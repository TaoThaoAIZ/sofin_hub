import { Link } from 'react-router-dom';
import { LegalLayout, LegalSection } from '../components/layout/LegalLayout';
import { markTermsRead } from '../features/auth/legalConsent';

export function TermsPage() {
  return (
    <LegalLayout title="Điều khoản sử dụng" updatedAt="28/09/2026" onRead={markTermsRead}>
      <p className="m-0 text-[15px] leading-[1.75] text-stone-600 text-pretty">
        Điều khoản sử dụng này ("Điều khoản") áp dụng cho toàn bộ dịch vụ do SofinHub cung cấp, bao gồm website, khóa
        học, cộng đồng và các tính năng liên quan (gọi chung là "Dịch vụ"). Khi tạo tài khoản hoặc sử dụng Dịch vụ,
        bạn đồng ý tuân thủ các điều khoản dưới đây.
      </p>

      <LegalSection title="1. Chấp nhận điều khoản">
        <p>
          Bằng việc truy cập hoặc sử dụng SofinHub, bạn xác nhận đã đọc, hiểu và đồng ý bị ràng buộc bởi Điều khoản
          này cùng với{' '}
          <Link to="/privacy" className="font-semibold underline">
            Chính sách bảo mật
          </Link>
          . Nếu không đồng ý, vui lòng ngừng sử dụng Dịch vụ.
        </p>
      </LegalSection>

      <LegalSection title="2. Tài khoản người dùng">
        <ul className="m-0 list-disc pl-5">
          <li>Bạn cần cung cấp thông tin chính xác khi đăng ký (họ tên, email) và có trách nhiệm cập nhật khi thay đổi.</li>
          <li>Bạn chịu trách nhiệm bảo mật mật khẩu và mọi hoạt động diễn ra dưới tài khoản của mình.</li>
          <li>Thông báo cho chúng tôi ngay nếu phát hiện tài khoản bị truy cập trái phép.</li>
          <li>Dịch vụ dành cho người từ 16 tuổi trở lên; người dưới 16 tuổi cần có sự đồng ý của phụ huynh/người giám hộ.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Khóa học và nội dung">
        <p>
          Khi tham gia một khóa học/cộng đồng có phí, bạn được cấp quyền truy cập nội dung cho mục đích học tập cá
          nhân, không độc quyền và không thể chuyển nhượng. Bạn không được sao chép, phân phối lại, bán hoặc công
          khai chia sẻ nội dung khóa học nếu không có sự cho phép bằng văn bản của SofinHub hoặc giảng viên sở hữu
          nội dung đó.
        </p>
      </LegalSection>

      <LegalSection title="4. Thanh toán, dùng thử và hủy">
        <ul className="m-0 list-disc pl-5">
          <li>Một số khóa học/cộng đồng tính phí theo tháng, được hiển thị rõ giá trước khi bạn tham gia.</li>
          <li>Nếu có chương trình dùng thử miễn phí, thời hạn và điều kiện sẽ được nêu rõ tại trang khóa học.</li>
          <li>Bạn có thể hủy gói bất kỳ lúc nào; việc hủy có hiệu lực từ chu kỳ thanh toán tiếp theo, trừ khi pháp luật có quy định khác.</li>
          <li>Chúng tôi không chịu trách nhiệm cho các giao dịch phát sinh do bạn để lộ thông tin đăng nhập hoặc thanh toán.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Quy tắc ứng xử trong cộng đồng">
        <p>Khi tham gia cộng đồng, bình luận hoặc đăng bài trên SofinHub, bạn đồng ý không:</p>
        <ul className="m-0 list-disc pl-5">
          <li>Đăng nội dung vi phạm pháp luật, xúc phạm, quấy rối, phân biệt đối xử hoặc gian lận;</li>
          <li>Mạo danh cá nhân/tổ chức khác hoặc phát tán thông tin sai sự thật;</li>
          <li>Spam, quảng cáo trái phép hoặc thu thập dữ liệu thành viên khác trái phép;</li>
          <li>Cố ý làm gián đoạn, phá hoại hệ thống hoặc bảo mật của Dịch vụ.</li>
        </ul>
        <p>Chúng tôi có quyền gỡ nội dung vi phạm và tạm khóa/chấm dứt tài khoản liên quan.</p>
      </LegalSection>

      <LegalSection title="6. Quyền sở hữu trí tuệ">
        <p>
          Toàn bộ thương hiệu, giao diện, mã nguồn và nội dung do SofinHub tạo ra thuộc quyền sở hữu của SofinHub hoặc
          bên cấp phép. Nội dung khóa học do giảng viên/đối tác cung cấp thuộc quyền sở hữu của họ, được cấp phép sử
          dụng qua SofinHub.
        </p>
      </LegalSection>

      <LegalSection title="7. Tạm ngưng và chấm dứt">
        <p>
          Chúng tôi có thể tạm ngưng hoặc chấm dứt quyền truy cập của bạn nếu vi phạm Điều khoản này. Bạn cũng có thể
          ngừng sử dụng Dịch vụ và yêu cầu xóa tài khoản bất cứ lúc nào.
        </p>
      </LegalSection>

      <LegalSection title="8. Giới hạn trách nhiệm">
        <p>
          Dịch vụ được cung cấp trên cơ sở "hiện có". Trong phạm vi pháp luật cho phép, SofinHub không chịu trách
          nhiệm cho các thiệt hại gián tiếp, ngẫu nhiên hoặc hệ quả phát sinh từ việc sử dụng hoặc không thể sử dụng
          Dịch vụ.
        </p>
      </LegalSection>

      <LegalSection title="9. Thay đổi điều khoản">
        <p>
          Chúng tôi có thể cập nhật Điều khoản này theo thời gian. Phiên bản mới sẽ có hiệu lực khi được đăng tải
          trên trang này; việc bạn tiếp tục sử dụng Dịch vụ sau khi cập nhật đồng nghĩa với việc chấp nhận thay đổi.
        </p>
      </LegalSection>

      <LegalSection title="10. Liên hệ">
        <p>
          Nếu có câu hỏi về Điều khoản sử dụng, vui lòng liên hệ đội ngũ SofinHub qua email{' '}
          <a href="mailto:support@sofinhub.com" className="font-semibold underline">
            support@sofinhub.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
