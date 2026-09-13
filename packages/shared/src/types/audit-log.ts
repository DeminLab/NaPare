export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface AuditLogWithUser extends AuditLog {
  userName?: string;
  userEmail?: string;
}
