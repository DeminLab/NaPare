import { assessCareerTaskRisk } from './career-risk-policy';

describe('Career triage policy: signals for mandatory human review', () => {
  const ordinary = { title: 'Подготовить макет страницы', description: 'Разработать макет и передать исходники', criteria: 'Открывается на мобильном экране', requirements: '', rewardKopecks: 100000, hours: 10 };
  it('does not invent risk flags for ordinary task terms', () => expect(assessCareerTaskRisk(ordinary)).toEqual([]));
  it.each(['Предоплата за доступ', 'Вступительный взнос', 'Страховой взнос', 'Купить обучение', 'Депозит исполнителя'])('flags payment language: %s', description => {
    expect(assessCareerTaskRisk({ ...ordinary, description })).toContain('upfront_payment');
  });
  it('leaves negation for a human rather than claiming semantic certainty', () => expect(assessCareerTaskRisk({ ...ordinary, description: 'Предоплата не требуется' })).toContain('upfront_payment'));
  it.each(['Аренда банковской карты', 'Передать банковскую карту', 'Оформить кредит', 'Сообщить код из СМС', 'Дро\u200bппер'])('normalizes and flags unsafe terms: %s', description => {
    expect(assessCareerTaskRisk({ ...ordinary, description })).toContain('unsafe_terms');
  });
  it('scans requirements and criteria as well as the visible title', () => expect(assessCareerTaskRisk({ ...ordinary, requirements: 'Нужен депозит' })).toContain('upfront_payment'));
  it('uses kopecks and includes exact amount/rate thresholds', () => {
    expect(assessCareerTaskRisk({ ...ordinary, rewardKopecks: 10_000_000, hours: 100 })).toEqual(['high_reward']);
    expect(assessCareerTaskRisk({ ...ordinary, rewardKopecks: 300_000, hours: 1 })).toEqual(['high_hourly_rate']);
    expect(assessCareerTaskRisk({ ...ordinary, rewardKopecks: 299_999, hours: 1 })).toEqual([]);
  });
  it.each([{ hours: 0 }, { hours: NaN }, { rewardKopecks: 0 }, { rewardKopecks: Infinity }])('never divides invalid legacy terms into a safe result: %p', changes => {
    expect(assessCareerTaskRisk({ ...ordinary, ...changes })).toContain('invalid_terms');
  });
});
