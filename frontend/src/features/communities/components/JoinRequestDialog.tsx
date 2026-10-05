import { useState } from 'react';
import { useCreateJoinRequest } from '../queries';
import type { JoinRequest } from '../types';
import { CancelButton, ErrorLine, errorText, INPUT_CLASS, Modal, PrimaryButton } from './Modal';

/** Hộp thoại gửi yêu cầu tham gia cộng đồng riêng tư (POST /courses/:id/join-requests). */
export function JoinRequestDialog({
  courseId,
  courseTitle,
  questions = [],
  rules = [],
  requireRules = false,
  onClose,
  onSent,
}: {
  courseId: string;
  courseTitle: string;
  questions?: string[];
  rules?: { title: string; body: string }[];
  requireRules?: boolean;
  onClose: () => void;
  onSent: (req: JoinRequest) => void;
}) {
  const [message, setMessage] = useState('');
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ''));
  const [accepted, setAccepted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const create = useCreateJoinRequest(courseId);
  const needRules = requireRules && rules.length > 0;

  const submit = () => {
    // Kiểm tra trước ở FE cho nhanh; BE vẫn xác thực lại (JOIN_ANSWERS_REQUIRED / RULES_NOT_ACCEPTED).
    if (answers.some((a) => !a.trim())) return setLocalError('Vui lòng trả lời đủ các câu hỏi gia nhập');
    if (needRules && !accepted) return setLocalError('Vui lòng đồng ý với nội quy cộng đồng để gửi yêu cầu');
    setLocalError(null);
    create.mutate({ message: message.trim(), answers: questions.length ? answers.map((a) => a.trim()) : undefined, acceptRules: needRules ? accepted : undefined }, {
      onSuccess: (req) => {
        onSent(req);
        onClose();
      },
    });
  };

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
      {questions.map((q, i) => (
        <label key={i} className="mt-3 block text-[13px] font-semibold text-stone-700">
          {q}
          <textarea
            value={answers[i] ?? ''}
            onChange={(e) => setAnswers((a) => a.map((v, k) => (k === i ? e.target.value : v)))}
            maxLength={500}
            rows={2}
            className={`${INPUT_CLASS} mt-1.5 resize-none font-normal`}
          />
        </label>
      ))}
      {needRules && (
        <div className="mt-3">
          <div className="max-h-32 overflow-auto rounded-xl border border-[rgba(120,60,20,.12)] bg-stone-50 p-3 text-[13px] text-stone-700">
            {rules.map((r, i) => (
              <div key={i} className="mb-1.5 last:mb-0">
                <b>
                  {i + 1}. {r.title}
                </b>
                {r.body && <span className="text-stone-500"> — {r.body}</span>}
              </div>
            ))}
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-stone-700">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="size-4 accent-[#f26a1b]" />
            Tôi đồng ý với nội quy cộng đồng
          </label>
        </div>
      )}
      {localError && <ErrorLine>{localError}</ErrorLine>}
      {!localError && create.isError && <ErrorLine>{errorText(create.error)}</ErrorLine>}
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
