import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../../lib/api';
import { digitsOnly, formatCardNumber, formatExpiry, tokenizeCard, toPaymentMethodInput, validateCard } from '../../../lib/card';
import { useToast } from '../../admin/components/overlay';
import { ModalActions, ModalError, ModalField, SettingsModal } from './Modal';
import { useAddCard, useReplaceCard } from './queries';
import type { SavedCard } from './api';

/**
 * Thêm thẻ mới / cập nhật thẻ. Số thẻ + CVC chỉ tồn tại trong state của hộp thoại này: kiểm Luhn/hạn/CVC rồi tokenize ở trình duyệt
 * (lib/card.ts), chỉ token + brand + 4 số cuối + hạn được gửi lên server.
 */
export function CardModal({ mode, card, onClose }: { mode: 'add' | 'update'; card?: SavedCard; onClose: () => void }) {
  const { t } = useTranslation('settings');
  const toast = useToast();
  const add = useAddCard();
  const replace = useReplaceCard();
  const [no, setNo] = useState('');
  const [exp, setExp] = useState('');
  const [cvc, setCvc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pending = add.isPending || replace.isPending;

  const submit = () => {
    const errs = validateCard({ number: no, expiry: exp, cvc });
    const first = errs.number ?? errs.expiry ?? errs.cvc;
    if (first) return setError(first);
    setError(null);
    const input = toPaymentMethodInput(tokenizeCard({ number: no, expiry: exp, cvc }));
    const done = (last4: string) => {
      toast.success(mode === 'add' ? t('card.addedToast', { last4 }) : t('card.updatedToast'));
      onClose();
    };
    const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : t('common.genericError'));
    if (mode === 'add') add.mutate(input, { onSuccess: (c) => done(c.last4), onError: fail });
    else replace.mutate({ id: card!.id, input }, { onSuccess: (c) => done(c.last4), onError: fail });
  };

  const title = mode === 'add' ? t('card.titleAdd') : card?.isDefault ? t('card.titleUpdateDefault') : t('card.titleUpdate', { last4: card?.last4 });
  return (
    <SettingsModal title={title} body={t('card.body')} onClose={onClose} busy={pending}>
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <ModalField label={t('card.number')} value={no} onChange={(v) => { setNo(formatCardNumber(v)); setError(null); }} placeholder="1234 1234 1234 1234" inputMode="numeric" autoComplete="cc-number" autoFocus />
        <ModalField label={t('card.expiry')} value={exp} onChange={(v) => { setExp(formatExpiry(v)); setError(null); }} placeholder="MM/YY" inputMode="numeric" autoComplete="cc-exp" />
        <ModalField label="CVC" value={cvc} onChange={(v) => { setCvc(digitsOnly(v).slice(0, 4)); setError(null); }} placeholder="123" inputMode="numeric" autoComplete="cc-csc" />
        {error && <ModalError>{error}</ModalError>}
        <ModalActions okLabel={mode === 'add' ? t('card.addBtn') : t('card.updateBtn')} onCancel={onClose} onOk={submit} pending={pending} />
      </form>
    </SettingsModal>
  );
}
