export type HomeworkSubmissionStatus = 'not_submitted' | 'submitted';

export interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  studentId: string;
  status: HomeworkSubmissionStatus;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface HomeworkSubmissionWithStudent extends HomeworkSubmission {
  studentName?: string;
  studentEmail?: string;
}
