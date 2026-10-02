import { Link } from 'react-router-dom';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { ButtonLink } from '../components/ui/Button';
import { ApiError } from '../lib/api';
import { RequireAuth } from '../features/auth/RequireAuth';
import { useMyEnrollments, useMyPoints } from '../features/account/queries';
import { REASON_LABEL, ROLE_LABEL, formatDate } from '../features/account/roles';
import { useDeleteDraft, useMyDrafts } from '../features/wizard/queries';
import { usePopup } from '../components/ui/usePopup';

export function MyCommunitiesPage() {
  return (
    <RequireAuth>
      <Content />
    </RequireAuth>
  );
}

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Không tải được dữ liệu, vui lòng thử lại');

function Content() {
  const { confirm } = usePopup();
  const enrollments = useMyEnrollments();
  const points = useMyPoints();
  const drafts = useMyDrafts();
  const deleteDraft = useDeleteDraft();

  const titleById = new Map<string, string>();
  for (const e of enrollments.data ?? []) titleById.set(e.course.id, e.course.title);
  for (const b of points.data?.byCourse ?? []) if ('title' in b.course) titleById.set(b.course.id, b.course.title);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-10 px-4 py-8 md:py-12">
        <section>
          <h1 className="mb-5 text-[clamp(26px,3vw,36px)] font-extrabold tracking-[-1px]">Cộng đồng của tôi</h1>
          {enrollments.isPending && <p className="text-stone-500">Đang tải…</p>}
          {enrollments.error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">{errMsg(enrollments.error)}</p>}
          {enrollments.data && enrollments.data.length === 0 && (
            <div className="glass grid place-items-center gap-3 rounded-3xl p-10 text-center">
              <p className="m-0 text-stone-600">Bạn chưa tham gia cộng đồng nào.</p>
              <div className="flex flex-wrap justify-center gap-3">
                <ButtonLink to="/" className="h-10 rounded-[14px] px-[18px] text-sm font-semibold">
                  Khám phá cộng đồng
                </ButtonLink>
                <ButtonLink to="/communities/new" className="h-10 rounded-[14px] px-[18px] text-sm font-semibold">
                  Tạo cộng đồng
                </ButtonLink>
              </div>
            </div>
          )}
          {enrollments.data && enrollments.data.length > 0 && (
            <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {enrollments.data.map((e) => (
                <li key={e.course.id} className="glass flex flex-col overflow-hidden rounded-3xl">
                  <img src={e.course.thumbnail} alt="" className="h-36 w-full object-cover" />
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div>
                      <div className="line-clamp-2 font-bold">{e.course.title}</div>
                      <div className="mt-1 text-[13px] text-stone-500">
                        {ROLE_LABEL[e.role] ?? e.role} · tham gia {formatDate(e.enrolledAt)}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-stone-500">
                        <span>Tiến độ</span>
                        <span className="font-semibold text-stone-700">{e.progressPct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuenow={e.progressPct} aria-valuemin={0} aria-valuemax={100}>
                        <div className="bg-brand-gradient h-full" style={{ width: `${e.progressPct}%` }} />
                      </div>
                    </div>
                    <ButtonLink to={`/communities/${e.course.id}/community`} className="mt-auto h-10 rounded-[14px] text-sm font-semibold">
                      Vào cộng đồng
                    </ButtonLink>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {drafts.data && drafts.data.length > 0 && (
          <section aria-label="Bản nháp cộng đồng">
            <h2 className="mb-4 text-2xl font-extrabold tracking-[-.5px]">Bản nháp cộng đồng</h2>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {drafts.data.map((d) => (
                <li key={d.id} className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{d.basics.title || 'Chưa đặt tên'}</div>
                    <div className="mt-0.5 text-[13px] text-stone-500">
                      Đã hoàn thành {d.completedSteps.length}/4 bước · sửa lần cuối {formatDate(d.updatedAt)}
                    </div>
                  </div>
                  <ButtonLink to={`/communities/new?draft=${encodeURIComponent(d.id)}`} className="h-10 rounded-[14px] px-[18px] text-sm font-semibold">
                    Tiếp tục tạo
                  </ButtonLink>
                  <button
                    type="button"
                    disabled={deleteDraft.isPending}
                    onClick={async () => {
                      if (await confirm({ title: 'Xóa bản nháp này?', message: 'Hành động này không thể hoàn tác.', tone: 'danger', confirmText: 'Xóa nháp' }))
                        deleteDraft.mutate(d.id);
                    }}
                    className="h-10 rounded-[14px] border border-[rgba(120,60,20,.15)] bg-white px-4 text-sm font-semibold text-stone-700 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                  >
                    Xóa nháp
                  </button>
                </li>
              ))}
            </ul>
            {deleteDraft.isError && <p role="alert" className="mt-2 text-sm font-medium text-red-600">{errMsg(deleteDraft.error)}</p>}
          </section>
        )}

        <section>
          <h2 className="mb-4 text-2xl font-extrabold tracking-[-.5px]">Điểm của tôi</h2>
          {points.isPending && <p className="text-stone-500">Đang tải điểm…</p>}
          {points.error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">{errMsg(points.error)}</p>}
          {points.data && (
            <div className="grid gap-4 md:grid-cols-[280px_1fr]">
              <div className="glass flex flex-col gap-3 rounded-3xl p-5">
                <div>
                  <div className="text-4xl font-extrabold text-brand">{points.data.total}</div>
                  <div className="text-sm text-stone-500">Tổng điểm</div>
                </div>
                {points.data.byCourse.length === 0 ? (
                  <p className="m-0 text-sm text-stone-500">Chưa có điểm nào.</p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
                    {points.data.byCourse.map((b) => (
                      <li key={b.course.id} className="flex justify-between gap-3">
                        <Link to={`/communities/${b.course.id}/community`} className="min-w-0 truncate">
                          {'title' in b.course ? b.course.title : 'Cộng đồng'}
                        </Link>
                        <b>{b.points}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="glass rounded-3xl p-5">
                <div className="mb-3 font-bold">Hoạt động điểm gần đây</div>
                {points.data.recent.length === 0 ? (
                  <p className="m-0 text-sm text-stone-500">Chưa có hoạt động nào.</p>
                ) : (
                  <ul className="m-0 flex list-none flex-col divide-y divide-stone-200/70 p-0 text-sm">
                    {points.data.recent.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <div className="font-medium">{REASON_LABEL[p.reason] ?? p.reason}</div>
                          <div className="truncate text-xs text-stone-500">
                            {titleById.get(p.courseId) ?? 'Cộng đồng'} · {new Date(p.createdAt).toLocaleString('vi-VN')}
                          </div>
                        </div>
                        <b className="text-brand">+{p.points}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
