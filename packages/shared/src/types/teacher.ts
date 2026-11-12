export interface Teacher {
  id: string;
  userId: string;
  organizationId: string;
  department?: string;
  position?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeacherWithUser extends Teacher {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
}
