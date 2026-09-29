import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Khung trang đơn giản (nền gradient + thẻ kính) cho quên mật khẩu / đặt lại / xác thực email. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div
      className="grid min-h-screen place-items-center px-4 py-10"
      style={{
        background:
          'radial-gradient(800px 600px at 10% 80%, rgba(255,160,100,.35), transparent 70%), radial-gradient(700px 500px at 90% 10%, rgba(255,200,160,.3), transparent 70%), linear-gradient(135deg, #fff7f1 0%, #fff 50%, #fff4ec 100%)',
      }}
    >
      <div className="flex w-full max-w-[480px] flex-col gap-5 rounded-[28px] border border-white/95 bg-white/70 p-6 shadow-[0_30px_70px_rgba(120,60,20,.12)] backdrop-blur-[26px] sm:p-10">
        <Link to="/" className="block self-center leading-none">
          <img src="/images/logo.png" alt="SofinHub" className="h-10 w-auto" />
        </Link>
        <div className="text-center">
          <h1 className="m-0 text-[26px] font-bold tracking-[-.5px]">{title}</h1>
          {subtitle && <p className="mt-2 mb-0 text-[15px] leading-[1.6] text-stone-600 text-pretty">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
