import { LessonChangeType } from '../constants/change-types';

export interface LessonChange {
  id: string;
  lessonId: string;
  changeType: LessonChangeType;
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  changedBy?: string;
  changedAt: Date;
  createdAt: Date;
}

export interface LessonChangeWithLesson extends LessonChange {
  lesson?: {
    id: string;
    subject: string;
    date: Date;
    pairNumber: number;
  };
}
