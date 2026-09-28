import { ButtonLink } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <p className="text-6xl font-extrabold text-brand">404</p>
        <p className="mt-3 text-stone-600">Trang này chưa có hoặc đang được xây dựng.</p>
        <ButtonLink to="/" className="mt-6 h-10 rounded-[14px] px-[18px] text-sm font-semibold">
          Về trang chủ
        </ButtonLink>
      </div>
    </main>
  );
}
