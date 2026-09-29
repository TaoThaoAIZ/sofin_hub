import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import type { Certificate } from '../types';
import { copyText, Dialog, ghostBtn, toast } from './contentUi';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });

export const verifyUrl = (code: string) => `${window.location.origin}/certificates/${encodeURIComponent(code)}`;

/** Thẻ chứng nhận — dùng cả trong hộp thoại của học viên lẫn trang xác minh công khai. */
export function CertificateView({ holderName, courseTitle, issuedAt, code }: { holderName: string; courseTitle: string; issuedAt: string; code?: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-brand/30 bg-gradient-to-br from-[#fff7f0] via-white to-[#ffe9d9] p-7 text-center shadow-[0_12px_32px_rgba(242,106,27,.14)]">
      <div className="pointer-events-none absolute inset-2 rounded-[20px] border border-brand/20" />
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand/10">
        <MaterialIcon name="workspace_premium" size={34} filled color="#f26a1b" />
      </span>
      <div className="mt-3 text-[12px] font-bold tracking-[.2em] text-brand uppercase">Chứng nhận hoàn thành</div>
      <div className="mt-4 text-[13px] text-stone-500">Chứng nhận rằng</div>
      <div className="mt-1 text-[28px] leading-tight font-extrabold break-words text-stone-900">{holderName}</div>
      <div className="mt-3 text-[13px] text-stone-500">đã hoàn thành 100% khóa học</div>
      <div className="mt-1 text-[19px] font-bold break-words text-stone-800">{courseTitle}</div>
      <div className="mt-4 text-[12.5px] text-stone-500">Cấp ngày {fmtDate(issuedAt)}</div>
      {code && (
        <div className="mt-4 inline-block rounded-lg bg-stone-900/5 px-3 py-1.5 font-mono text-[12px] break-all text-stone-700">Mã: {code}</div>
      )}
    </div>
  );
}

export function CertificateDialog({ cert, onClose }: { cert: Certificate; onClose: () => void }) {
  const url = verifyUrl(cert.code);
  return (
    <Dialog
      wide
      title="Chứng nhận của bạn"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={ghostBtn}
            onClick={async () => toast((await copyText(url)) ? 'Đã sao chép đường dẫn xác minh' : 'Không sao chép được', 'ok')}
          >
            <MaterialIcon name="link" size={18} /> Sao chép link xác minh
          </button>
          <button type="button" className={ghostBtn} onClick={() => window.print()}>
            <MaterialIcon name="print" size={18} /> In
          </button>
        </>
      }
    >
      <CertificateView holderName={cert.holderName} courseTitle={cert.courseTitle} issuedAt={cert.issuedAt} code={cert.code} />
      <p className="mt-3 mb-0 text-[12.5px] break-all text-stone-500">
        Ai cũng có thể xác minh chứng nhận này (không cần đăng nhập) tại:{' '}
        <a href={url} target="_blank" rel="noreferrer noopener" className="font-semibold text-brand hover:underline">
          {url}
        </a>
      </p>
    </Dialog>
  );
}
