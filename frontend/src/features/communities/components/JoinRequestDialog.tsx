import { useState } from 'react';
import { useCreateJoinRequest } from '../queries';
import type { JoinRequest } from '../types';
import { CancelButton, ErrorLine, errorText, INPUT_CLASS, Modal, PrimaryButton } from './Modal';

/** Hộp thoại gửi yêu cầu tham gia cộng đồng riêng tư (POST /courses/:id/join-requests). */
export function JoinRequestDialog({
  courseId,
  courseTitle,
  onClose,
  onSent,
}: {
  courseId: string;
  courseTitle: string;
  onClose: () => void;
  onSent: (req: JoinRequest) => void;
}) {
  const [message, setMessage] = useState('');
  const create = useCreateJoinRequest(courseId);

  const submit = () =>
    create.mutate(message.trim(), {
      onSuccess: (req) => {
        onSent(req);
        onClose();
      },
    });

  return (
    <Modal
      title="Cộng đồng riêng tư"
      icon="lock"
      onClose={onClose}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <PrimaryButton onClick={submit} disabled={create.isPending}>
            {create.isPending ? 'Đang gửi…' : 'Gửi yêu cầu'}
          </PrimaryButton>
        </>
      }
    >
      <p>
        "{courseTitle}" là cộng đồng riêng tư. Hãy gửi yêu cầu kèm lời nhắn, quản trị viên sẽ xem xét và thông báo cho bạn.
      </p>
      <label className="mt-3 block text-[13px] font-semibold text-stone-700">
        Lời nhắn (không bắt buộc)
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="Giới thiệu ngắn về bạn và lý do muốn tham gia…"
          className={`${INPUT_CLASS} mt-1.5 resize-none font-normal`}
        />
      </label>
      <div className="mt-1 text-right text-xs text-stone-400">{message.length}/500</div>
      {create.isError && <ErrorLine>{errorText(create.error)}</ErrorLine>}
    </Modal>
  );
}

// ---- Nhớ yêu cầu đang chờ của tôi ----
// BE chưa có endpoint "yêu cầu của tôi" nên id yêu cầu (cần để hủy) được nhớ ở trình duyệt.
const storageKey = (courseId: string) => `sofin:joinRequest:${courseId}`;

export function loadPendingRequestId(courseId: string): string | null {
  try {
    return localStorage.getItem(storageKey(courseId));
  } catch {
    return null;
  }
}

export function savePendingRequestId(courseId: string, id: string | null) {
  try {
    if (id) localStorage.setItem(storageKey(courseId), id);
    else localStorage.removeItem(storageKey(courseId));
  } catch {
    /* bỏ qua: trình duyệt chặn lưu trữ */
  }
}
