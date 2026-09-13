export interface Group {
  id: string;
  facultyId: string;
  universityId: string;
  name: string;
  curriculumYear: number;
  specialization?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupWithDetails extends Group {
  facultyName?: string;
  course: number;
  curatorId?: string;
  curatorName?: string;
  studentsCount: number;
}
