import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useClickOutside } from '../../../lib/useClickOutside';
import { useCommunityDetail } from '../../courses/queries';
import { useCancelRsvp, useCreateEvent, useDeleteEvent, useDownloadIcs, useEvents, useToggleRsvp, useUpdateEvent } from '../queries';
import type { CommunityEvent } from '../types';
import { areaCls, ConfirmDialog, Dialog, errText, ErrorNote, ghostBtn, inputCls, isModPlus, primaryBtn, safeUrl, toast, ToastHost, toLocalInput } from './contentUi';
import { PageBanner } from './shared';

type View = 'month' | 'week' | 'day';
type EventFilter = 'all' | 'upcoming' | 'rsvped';

const VIEWS: { key: View; label: string }[] = [
  { key: 'month', label: 'Tháng' },
  { key: 'week', label: 'Tuần' },
  { key: 'day', label: 'Ngày' },
];
const FILTERS: { key: EventFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả sự kiện' },
  { key: 'upcoming', label: 'Sắp diễn ra' },
  { key: 'rsvped', label: 'Tôi đã đăng ký' },
];
const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const mondayOf = (d: Date) => {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const toolBtn =
  'flex h-11 items-center gap-2 rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-[18px] text-sm font-medium shadow-[0_1px_2px_rgba(120,60,20,.05)] hover:bg-[#fff7f0]';

function buildDays(view: View, cur: Date): Date[] {
  if (view === 'day') return [cur];
  if (view === 'week') {
    const s = mondayOf(cur);
    return Array.from({ length: 7 }, (_, i) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + i));
  }
  const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const last = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
  const start = mondayOf(first);
  const n = Math.ceil((((first.getDay() + 6) % 7) + last.getDate()) / 7) * 7;
  return Array.from({ length: n }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export function CalendarTab() {
  const { id: courseId = '' } = useParams();
  const { data: course } = useCommunityDetail(courseId);
  const canManage = isModPlus(course?.viewerRole);
  const events = useEvents(courseId);
  const rsvp = useToggleRsvp(courseId);
  const cancelRsvp = useCancelRsvp(courseId);
  const createEvent = useCreateEvent(courseId);
  const downloadIcs = useDownloadIcs();

  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState<View>('month');
  const [cur, setCur] = useState(today);
  const [filter, setFilter] = useState<EventFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  useClickOutside(filterRef, () => setFilterOpen(false));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState('');

  const shift = (k: number) => {
    const d = new Date(cur);
    if (view === 'month') d.setMonth(d.getMonth() + k, 1);
    else d.setDate(d.getDate() + k * (view === 'week' ? 7 : 1));
    setCur(d);
  };

  const days = buildDays(view, cur);
  const cols = view === 'day' ? 1 : 7;
  const heads = view === 'day' ? [DAY_NAMES[(cur.getDay() + 6) % 7]!] : DAY_NAMES;
  const title_ =
    view === 'day'
      ? `${cur.getDay() === 0 ? 'Chủ nhật' : `Thứ ${cur.getDay() + 1}`}, ${cur.getDate()} tháng ${cur.getMonth() + 1} ${cur.getFullYear()}`
      : `Tháng ${cur.getMonth() + 1} ${cur.getFullYear()}`;

  const visible = (events.data ?? []).filter((e) => (filter === 'upcoming' ? !e.isPast : filter === 'rsvped' ? e.viewerRsvped : true));
  const eventsOn = (d: Date) => visible.filter((e) => sameDay(new Date(e.startAt), d)).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const selected = events.data?.find((e) => e.id === selectedId) ?? null;
  const rowH = view === 'month' ? 'min-h-[118px]' : 'min-h-[420px]';

  return (
    <main className="flex min-w-0 flex-col gap-4">
      <PageBanner image="cal-hero-bg.webp" icon="calendar_month" title="Lịch sự kiện" className="min-h-[148px]" />

      <section className="glass rounded-3xl p-4">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <button onClick={() => setCur(today)} className={toolBtn}>
            Hôm nay
          </button>
          <div className="flex h-11 overflow-hidden rounded-xl border border-[rgba(120,60,20,.12)] bg-white">
            <button onClick={() => shift(-1)} aria-label="Trước" className="grid w-12 place-items-center hover:bg-[#fff7f0]">
              <MaterialIcon name="chevron_left" />
            </button>
            <span className="w-px bg-[rgba(120,60,20,.12)]" />
            <button onClick={() => shift(1)} aria-label="Sau" className="grid w-12 place-items-center hover:bg-[#fff7f0]">
              <MaterialIcon name="chevron_right" />
            </button>
          </div>
          <div>
            <div className="text-[17px] font-bold">{title_}</div>
            <div className="mt-0.5 text-[12.5px] text-stone-600">GMT+7 • Hồ Chí Minh</div>
          </div>

          <div className="ml-auto flex gap-1 rounded-[14px] border border-[rgba(120,60,20,.12)] bg-white p-1">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={`h-9 rounded-[10px] px-[22px] text-[14.5px] ${
                  view === v.key
                    ? 'bg-gradient-to-b from-[#fff1e6] to-[#ffe4d1] font-semibold text-brand shadow-[inset_0_0_0_1px_rgba(242,106,27,.2)]'
                    : 'font-medium text-stone-600'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div ref={filterRef} className="relative">
            <button onClick={() => setFilterOpen((o) => !o)} className={`${toolBtn} ${filter !== 'all' ? 'text-brand' : ''}`}>
              <MaterialIcon name="filter_alt" size={19} />
              Lọc sự kiện
            </button>
            {filterOpen && (
              <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-[rgba(120,60,20,.12)] bg-white p-1.5 shadow-lg">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => {
                      setFilter(f.key);
                      setFilterOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13.5px] hover:bg-stone-50 ${filter === f.key ? 'font-semibold text-brand' : ''}`}
                  >
                    {f.label}
                    {filter === f.key && <MaterialIcon name="check" size={17} color="#f26a1b" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => downloadIcs.mutate({ courseId }, { onSuccess: () => toast('Đã tải lịch cộng đồng (.ics)'), onError: (e) => toast(errText(e), 'error') })}
            disabled={downloadIcs.isPending}
            className={toolBtn}
            title="Tải file .ics chứa mọi sự kiện của cộng đồng để nhập vào Google/Apple/Outlook Calendar"
          >
            <MaterialIcon name="event_repeat" size={19} />
            Đăng ký lịch cả cộng đồng
          </button>

          {canManage && <button onClick={() => setShowForm((s) => !s)} className="flex h-11 items-center gap-2 rounded-xl bg-brand px-[18px] text-sm font-bold text-white">
            <MaterialIcon name={showForm ? 'close' : 'add'} size={19} color="#fff" />
            {showForm ? 'Đóng' : 'Tạo sự kiện'}
          </button>}
        </div>

        {showForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim() || !date) return;
              createEvent.mutate(
                {
                  title,
                  description: description.trim(),
                  startAt: new Date(date).toISOString(),
                  timezone: 'Asia/Ho_Chi_Minh',
                  meetingLink: meetingLink.trim() || undefined,
                  capacity: capacity ? Number(capacity) : undefined,
                },
                {
                  onSuccess: () => {
                    setTitle('');
                    setDate('');
                    setMeetingLink('');
                    setDescription('');
                    setCapacity('');
                    setShowForm(false);
                    toast('Đã tạo sự kiện');
                  },
                },
              );
            }}
            className="mb-4 grid gap-3 rounded-2xl border border-[rgba(120,60,20,.1)] bg-white p-3 sm:grid-cols-2"
          >
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên sự kiện" aria-label="Tên sự kiện" required maxLength={160} className={inputCls} />
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Thời gian bắt đầu" required className={inputCls} />
            <input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="Link họp (không bắt buộc)" aria-label="Link họp" className={inputCls} />
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Sức chứa (để trống = không giới hạn)" aria-label="Sức chứa" className={inputCls} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} placeholder="Mô tả sự kiện (không bắt buộc)" aria-label="Mô tả" className={`${areaCls} sm:col-span-2`} />
            <div className="flex items-center gap-3 sm:col-span-2">
              <button type="submit" disabled={createEvent.isPending} className={primaryBtn}>
                {createEvent.isPending ? 'Đang tạo…' : 'Tạo sự kiện'}
              </button>
              <ErrorNote message={createEvent.isError ? errText(createEvent.error) : null} />
            </div>
          </form>
        )}

        <div className="overflow-hidden rounded-[14px] border border-[rgba(120,60,20,.1)] bg-white">
          <div className="grid border-b border-[rgba(120,60,20,.1)]" style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` }}>
            {heads.map((h, i) => (
              <div key={h} className={`grid h-11 place-items-center text-[13px] font-semibold ${i ? 'border-l border-[rgba(120,60,20,.08)]' : ''}`}>
                {h}
              </div>
            ))}
          </div>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` }}>
            {days.map((d, i) => {
              const isToday = sameDay(d, today);
              const out = view === 'month' && d.getMonth() !== cur.getMonth();
              const dayEvents = eventsOn(d);
              return (
                <div
                  key={d.toISOString()}
                  className={`${rowH} min-w-0 p-3 ${i % cols ? 'border-l border-[rgba(120,60,20,.08)]' : ''} ${i >= cols ? 'border-t border-[rgba(120,60,20,.08)]' : ''} ${
                    isToday ? 'bg-gradient-to-b from-[#fff1e6] to-[#fff7f0]' : ''
                  }`}
                >
                  <span
                    className={
                      isToday
                        ? '-mt-1.5 -ml-1 grid size-[34px] place-items-center rounded-full bg-gradient-to-b from-[#ff8f45] to-brand text-[13.5px] font-bold text-white shadow-[0_6px_14px_rgba(242,106,27,.35)]'
                        : `text-[13.5px] font-medium ${out ? 'text-stone-400' : 'text-stone-900'}`
                    }
                  >
                    {d.getDate()}
                  </span>
                  <div className="mt-1.5 flex flex-col gap-1">
                    {dayEvents.slice(0, view === 'month' ? 3 : 20).map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedId(ev.id)}
                        className={`truncate rounded-md px-1.5 py-1 text-left text-[11.5px] font-semibold ${
                          ev.isPast ? 'bg-stone-100 text-stone-500 opacity-60' : 'bg-brand/15 text-brand-dark hover:bg-brand/25'
                        }`}
                      >
                        {timeOf(ev.startAt)} {ev.title}
                      </button>
                    ))}
                    {view === 'month' && dayEvents.length > 3 && <span className="px-1 text-[11px] text-stone-500">+{dayEvents.length - 3} nữa</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {events.isPending && <p className="pt-3 text-center text-sm text-stone-400">Đang tải sự kiện…</p>}
      </section>

      {selected && (
        <EventDialog
          key={selected.id}
          courseId={courseId}
          ev={selected}
          canManage={canManage}
          rsvpPending={rsvp.isPending || cancelRsvp.isPending}
          rsvpError={rsvp.isError ? errText(rsvp.error) : cancelRsvp.isError ? errText(cancelRsvp.error) : null}
          onRsvp={() => (selected.viewerRsvped ? cancelRsvp.mutate(selected.id) : rsvp.mutate(selected.id))}
          onClose={() => setSelectedId(null)}
        />
      )}
      <ToastHost />
    </main>
  );
}

function EventDialog({
  courseId,
  ev,
  canManage,
  rsvpPending,
  rsvpError,
  onRsvp,
  onClose,
}: {
  courseId: string;
  ev: CommunityEvent;
  canManage: boolean;
  rsvpPending: boolean;
  rsvpError: string | null;
  onRsvp: () => void;
  onClose: () => void;
}) {
  const update = useUpdateEvent(courseId);
  const remove = useDeleteEvent(courseId);
  const downloadIcs = useDownloadIcs();
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [title, setTitle] = useState(ev.title);
  const [description, setDescription] = useState(ev.description ?? '');
  const [startAt, setStartAt] = useState(toLocalInput(ev.startAt));
  const [meetingLink, setMeetingLink] = useState(ev.meetingLink ?? '');
  const [capacity, setCapacity] = useState(ev.capacity ? String(ev.capacity) : '');

  const full = !!ev.capacity && ev.rsvpCount >= ev.capacity && !ev.viewerRsvped;
  const link = safeUrl(ev.meetingLink);

  if (editing) {
    return (
      <Dialog
        title="Sửa sự kiện"
        onClose={onClose}
        footer={
          <>
            <button type="button" onClick={() => setEditing(false)} className={ghostBtn}>
              Hủy
            </button>
            <button
              type="button"
              disabled={update.isPending || !title.trim() || !startAt}
              className={primaryBtn}
              onClick={() =>
                update.mutate(
                  {
                    eventId: ev.id,
                    body: {
                      title: title.trim(),
                      description: description.trim(),
                      startAt: new Date(startAt).toISOString(),
                      meetingLink: meetingLink.trim() || null,
                      capacity: capacity ? Number(capacity) : null,
                    },
                  },
                  {
                    onSuccess: () => {
                      toast('Đã cập nhật sự kiện');
                      setEditing(false);
                    },
                  },
                )
              }
            >
              {update.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-2.5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} aria-label="Tên sự kiện" placeholder="Tên sự kiện" className={inputCls} />
          <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} aria-label="Thời gian bắt đầu" className={inputCls} />
          <input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} aria-label="Link họp" placeholder="Link họp (để trống để xóa)" className={inputCls} />
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            aria-label="Sức chứa"
            placeholder={`Sức chứa (để trống = không giới hạn; đã có ${ev.rsvpCount} đăng ký)`}
            className={inputCls}
          />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} aria-label="Mô tả" placeholder="Mô tả" className={areaCls} />
          <ErrorNote message={update.isError ? errText(update.error) : null} />
        </div>
      </Dialog>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div role="dialog" aria-label={ev.title} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="grid size-12 flex-none place-items-center rounded-xl bg-brand/10">
            <MaterialIcon name="event" size={26} filled color="#f26a1b" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-extrabold">{ev.title}</div>
            <div className="mt-0.5 text-[13px] text-stone-500">
              {new Date(ev.startAt).toLocaleString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <button onClick={onClose} aria-label="Đóng" className="text-stone-400 hover:text-stone-700">
            <MaterialIcon name="close" size={22} />
          </button>
        </div>
        {ev.description && <p className="mt-3 text-sm whitespace-pre-wrap text-stone-700">{ev.description}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-stone-600">
          <span>
            {ev.rsvpCount}
            {ev.capacity ? `/${ev.capacity}` : ''} người đã đăng ký
          </span>
          {ev.isPast && <span className="rounded-md bg-stone-200 px-1.5 py-0.5 text-xs font-semibold text-stone-600">Đã diễn ra</span>}
          {full && <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">Đã đầy chỗ</span>}
        </div>
        {link && (
          <a href={link} target="_blank" rel="noreferrer noopener" className="mt-2 block truncate text-[13px] text-brand hover:underline">
            {ev.meetingLink}
          </a>
        )}

        {!ev.isPast ? (
          <button
            onClick={onRsvp}
            disabled={rsvpPending || full}
            className={`mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold disabled:opacity-60 ${ev.viewerRsvped ? 'bg-brand/10 text-brand' : 'bg-brand text-white'}`}
          >
            {ev.viewerRsvped && <MaterialIcon name="check" size={18} color="#f26a1b" />}
            {rsvpPending ? 'Đang xử lý…' : full ? 'Đã đầy chỗ' : ev.viewerRsvped ? 'Đã đăng ký — bấm để hủy' : 'Đăng ký tham gia'}
          </button>
        ) : (
          <p className="mt-5 text-center text-sm text-stone-500">Sự kiện đã diễn ra</p>
        )}
        <div className="mt-2">
          <ErrorNote message={rsvpError} />
        </div>

        <button
          type="button"
          onClick={() => downloadIcs.mutate({ eventId: ev.id }, { onSuccess: () => toast('Đã tải file lịch (.ics)'), onError: (e) => toast(errText(e), 'error') })}
          disabled={downloadIcs.isPending}
          className={`${ghostBtn} mt-3 w-full`}
        >
          <MaterialIcon name="calendar_add_on" size={19} />
          Thêm vào lịch (.ics)
        </button>

        {canManage && (
          <div className="mt-3 flex gap-2.5 border-t border-[rgba(120,60,20,.08)] pt-3">
            <button type="button" onClick={() => setEditing(true)} className={`${ghostBtn} flex-1`}>
              <MaterialIcon name="edit" size={18} /> Sửa
            </button>
            <button type="button" onClick={() => setConfirmDel(true)} className={`${ghostBtn} flex-1 !text-red-600`}>
              <MaterialIcon name="delete" size={18} color="#dc2626" /> Xóa
            </button>
          </div>
        )}
      </div>
      {confirmDel && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmDialog
            title="Xóa sự kiện?"
            message={`Sự kiện "${ev.title}" sẽ bị xóa và những người đã đăng ký sẽ nhận được thông báo.`}
            confirmLabel="Xóa sự kiện"
            pending={remove.isPending}
            error={remove.isError ? errText(remove.error) : null}
            onClose={() => setConfirmDel(false)}
            onConfirm={() =>
              remove.mutate(ev.id, {
                onSuccess: () => {
                  toast('Đã xóa sự kiện');
                  onClose();
                },
              })
            }
          />
        </div>
      )}
    </div>
  );
}
