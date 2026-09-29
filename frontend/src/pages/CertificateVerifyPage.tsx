import { Link, useParams } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { ApiError } from '../lib/api';
import { CertificateView } from '../features/community/components/CertificateCard';
import { useVerifyCertificate } from '../features/community/queries';

/** Trang công khai xác minh chứng nhận — không cần đăng nhập (GET /certificates/:code). */
export function CertificateVerifyPage() {
  const { code = '' } = useParams();
  const q = useVerifyCertificate(code);
  const notFound = q.isError && q.error instanceof ApiError && q.error.status === 404;

  return (
    <div className="min-h-screen bg-[#fdfbfa]">
      <Header />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
        <h1 className="m-0 text-center text-[26px] font-extrabold tracking-tight">Xác minh chứng nhận</h1>
        {q.isPending && <p className="py-10 text-center text-stone-400">Đang xác minh…</p>}
        {q.isSuccess && (
          <>
            <p className="m-0 flex items-center justify-center gap-2 text-[14px] font-semibold text-emerald-600">
              <MaterialIcon name="verified" size={20} filled color="#059669" /> Chứng nhận hợp lệ
            </p>
            <CertificateView holderName={q.data.holderName} courseTitle={q.data.courseTitle} issuedAt={q.data.issuedAt} code={code} />
          </>
        )}
        {q.isError && (
          <div className="glass flex flex-col items-center gap-2 rounded-3xl p-8 text-center">
            <MaterialIcon name="gpp_bad" size={40} filled color="#dc2626" />
            <div className="text-lg font-extrabold">{notFound ? 'Không tìm thấy chứng nhận' : 'Không xác minh được'}</div>
            <p className="m-0 text-sm text-stone-600">
              {notFound ? `Mã "${code}" không tồn tại hoặc không hợp lệ. Hãy kiểm tra lại đường dẫn.` : q.error.message}
            </p>
          </div>
        )}
        <Link to="/" className="text-center text-sm font-semibold text-brand hover:underline">
          Về trang chủ SofinHub
        </Link>
      </main>
    </div>
  );
}
