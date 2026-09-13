import { Role } from '../constants/roles';

export interface University {
  id: string;
  name: string;
  city: string;
  connectorType?: string;
  connectorConfig?: Record<string, any>;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

export interface UniversityWithStats extends University {
  totalStudents: number;
  totalTeachers: number;
  totalGroups: number;
}
