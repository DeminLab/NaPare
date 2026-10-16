import type { HTMLAttributes } from 'react';

const labels: Record<string, string> = {
  lecture: 'Лекция',
  practice: 'Практика',
  lab: 'Лабораторная',
  seminar: 'Семинар',
  exam: 'Экзамен',
  consultation: 'Консультация',
  coursework: 'Курсовая',
  test: 'Зачёт',
};

function semanticType(subjectType?: string) {
  const type = subjectType?.trim().toLocaleLowerCase('ru-RU').replace(/\./g, '');
  if (!type) return undefined;
  if (type === 'lecture' || /^лек/u.test(type)) return 'lecture';
  if (type === 'practice' || type === 'пр' || /^практ/u.test(type)) return 'practice';
  if (type === 'lab' || type.startsWith('лаб') || type.startsWith('лаборатор')) return 'lab';
  return undefined;
}

export function lessonTypeKey(subjectType?: string) {
  return semanticType(subjectType) || subjectType?.trim().toLocaleLowerCase('ru-RU').replace(/\./g, '') || '';
}

export function lessonTypeLabel(subjectType?: string) {
  if (!subjectType) return 'Занятие';
  const semantic = semanticType(subjectType);
  if (semantic) return labels[semantic];
  const normalized = subjectType.trim().toLocaleLowerCase('ru-RU').replace(/\./g, '');
  if (normalized === 'seminar' || normalized.startsWith('семинар')) return 'Семинар';
  return labels[normalized] || subjectType;
}

export function lessonTypeDotClass(subjectType?: string) {
  const type = semanticType(subjectType);
  if (type === 'lecture') return 'bg-[var(--color-lesson-lecture)]';
  if (type === 'practice') return 'bg-[var(--color-lesson-practice)]';
  if (type === 'lab') return 'bg-[var(--color-lesson-lab)]';
  return 'bg-[var(--color-lesson-other)]';
}

export function LessonTypeBadge({ subjectType, className = '', ...props }: HTMLAttributes<HTMLSpanElement> & { subjectType?: string }) {
  const tone = semanticType(subjectType) || 'other';
  return <span className={`lesson-type-badge ${className}`.trim()} data-type={tone} {...props}>
    <span className="lesson-type-badge__dot" aria-hidden="true" />
    {lessonTypeLabel(subjectType)}
  </span>;
}
