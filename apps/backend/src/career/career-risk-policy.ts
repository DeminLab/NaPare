/** Project triage rules, not a fraud verdict or a statement about lawful prices. */
export const CAREER_RISK_POLICY_VERSION = 'career-risk-v1';
export const CAREER_RISK_LABELS: Record<string, string> = {
  unsafe_terms: 'Потенциально опасные условия или передача финансовых реквизитов',
  upfront_payment: 'Упоминание предварительной оплаты, взноса или депозита',
  high_reward: 'Сумма от 100 000 рублей требует дополнительного рассмотрения',
  high_hourly_rate: 'Ставка от 3 000 рублей в час требует дополнительного рассмотрения',
  invalid_terms: 'Некорректная сумма или трудоёмкость задачи',
  open_complaints: 'Есть открытые жалобы, которые нужно рассмотреть',
};
type RiskInput = { title: string; description: string; criteria: string; requirements?: string; rewardKopecks: number; hours: number };

export function assessCareerTaskRisk(task: RiskInput): string[] {
  const text = [task.title, task.description, task.criteria, task.requirements || ''].join(' ')
    .normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ');
  const flags: string[] = [];
  if (/дроппер|обнал|аренд\p{L}* (?:банковск\p{L}* )?карт|переда\p{L}* банковск\p{L}* карт|оформ\p{L}* кредит|код\p{L}* из смс/u.test(text)) flags.push('unsafe_terms');
  // Negated mentions are deliberately retained for a human to read in context.
  if (/предоплат|депозит|вступительн\p{L}* взнос|страхов\p{L}* взнос|оплат\p{L}* доступ|куп\p{L}* обучени/u.test(text)) flags.push('upfront_payment');
  if (!Number.isSafeInteger(task.rewardKopecks) || task.rewardKopecks < 100 || task.rewardKopecks > 100_000_000 ||
    !Number.isSafeInteger(task.hours) || task.hours < 1 || task.hours > 500) flags.push('invalid_terms');
  else {
    if (task.rewardKopecks >= 10_000_000) flags.push('high_reward');
    if (task.rewardKopecks / task.hours >= 300_000) flags.push('high_hourly_rate');
  }
  return flags;
}
