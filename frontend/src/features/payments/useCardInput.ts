import { useState } from 'react';
import { toPaymentMethodInput, tokenizeCard, validateCard, type CardErrors, type CardForm, type PaymentMethodInput } from '../../lib/card';

const emptyCard = (): CardForm => ({ number: '', expiry: '', cvc: '' });

/**
 * State + kiểm tra + tokenise (mock) của ô nhập thẻ, dùng chung cho hộp thoại tham gia (JoinCheckout) và mua lẻ module.
 * `collect()` trả PaymentMethodInput (chỉ token + brand/last4/hạn) hoặc null nếu thẻ chưa hợp lệ; số thẻ/CVC thô bị xóa ngay sau khi tokenise.
 */
export function useCardInput() {
  const [card, setCardState] = useState<CardForm>(emptyCard);
  const [errors, setErrors] = useState<CardErrors>({});
  return {
    card,
    errors,
    setCard: (v: CardForm) => {
      setCardState(v);
      setErrors({});
    },
    collect(): PaymentMethodInput | null {
      const ce = validateCard(card);
      setErrors(ce);
      if (Object.keys(ce).length) return null;
      const pm = toPaymentMethodInput(tokenizeCard(card));
      setCardState(emptyCard());
      return pm;
    },
  };
}
