export interface Faculty {
  id: string;
  universityId: string;
  name: string;
  code: string;
  deanUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacultyWithStats extends Faculty {
  deanName?: string;
  coursesCount: number;
  groupsCount: number;
}
