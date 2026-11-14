/** Org-approved second factor types; weak factors are never used alone (FR-ONB-03). */
export const INVITE_FACTOR_TYPES = ['student_card', 'birth_date', 'phone_last4'] as const;
export type InviteFactorType = (typeof INVITE_FACTOR_TYPES)[number];

/** Default invite lifetime (FR-ONB-02). */
export const INVITE_TTL_DAYS = 14;

/** Per-invite attempt limit before the flow locks and staff is notified (SEC-09). */
export const INVITE_MAX_ATTEMPTS = 5;

/**
 * SEC-09: "no such invite" and "wrong data/factor" are indistinguishable —
 * one code and one message for every non-successful, non-limit claim path.
 */
export const INVITE_UNIFORM_MESSAGE =
  'Приглашение недействительно или данные привязки не подтверждены.';
