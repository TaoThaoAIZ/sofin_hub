import { z } from 'zod';

export const accountBody = z.object({
  bankBin: z.string().trim().regex(/^\d{6}$/, 'Ngân hàng không hợp lệ'),
  accountNumber: z.string().trim().min(6, 'Nhập số tài khoản').max(30),
  accountHolder: z.string().trim().min(2, 'Nhập tên chủ tài khoản').max(80),
});
export const withdrawBody = z.object({ amountCents: z.number({ error: 'Nhập số tiền cần rút' }).int('Số tiền phải là số nguyên') });
export const adminWithdrawalsQuery = z.object({
  status: z.enum(['requested', 'paid', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const rejectBody = z.object({ reason: z.string().trim().min(3, 'Nhập lý do từ chối').max(300) });
export const noteBody = z.object({ note: z.string().trim().max(300).optional() });
