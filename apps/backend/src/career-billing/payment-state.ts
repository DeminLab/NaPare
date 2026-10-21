import { ConflictException } from '@nestjs/common';

export type PaymentState = 'created' | 'pending' | 'succeeded' | 'canceled' | 'unknown' | 'partially_refunded' | 'refunded';
const pending = new Set(['NEW', 'FORM_SHOWED', 'AUTHORIZING', '3DS_CHECKING', '3DS_CHECKED', 'CONFIRMING']);
export function normalizeTkassaStatus(status: unknown): PaymentState {
  if (pending.has(String(status))) return 'pending';
  if (status === 'CONFIRMED') return 'succeeded';
  if (['CANCELED', 'REJECTED', 'AUTH_FAIL', 'DEADLINE_EXPIRED'].includes(String(status))) return 'canceled';
  if (status === 'PARTIAL_REFUNDED') return 'partially_refunded';
  if (status === 'REFUNDED') return 'refunded';
  if (status === 'REFUNDING') return 'succeeded';
  throw new ConflictException('Неизвестный статус платежа требует сверки');
}
/** Late or duplicate notifications cannot reopen a completed/refunded payment. */
export function advancePaymentState(current: PaymentState, incoming: PaymentState): PaymentState {
  if (current === 'refunded') return current;
  if (current === 'partially_refunded' && incoming !== 'refunded') return current;
  if (current === 'succeeded' && !['refunded', 'partially_refunded'].includes(incoming)) return current;
  if (current === 'canceled' && incoming === 'pending') return current;
  return incoming;
}
