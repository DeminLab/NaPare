export type AbsenceConfirmationStatus = 'pending' | 'confirmed' | 'rejected';

export interface AbsenceConfirmation {
  id: string;
  absenceId: string;
  curatorId: string;
  status: AbsenceConfirmationStatus;
  comment?: string;
  confirmedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AbsenceConfirmationWithUsers extends AbsenceConfirmation {
  curatorName?: string;
  studentName?: string;
}
