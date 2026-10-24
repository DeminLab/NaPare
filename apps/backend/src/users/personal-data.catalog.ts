/** Reviewed export projections. Never SELECT *: new database columns are private by default. */
export interface PersonalDataset {
  name: string;
  table: string;
  key: string;
  columns: string[];
  /** Direct account references, not client-supplied column names. */
  owners: string[];
  where?: string;
}
const entry = (table: string, owner: string, fields: string, key = 'id'): PersonalDataset => ({
  name: table, table, key, owners: [owner], columns: fields.split(' '),
});
const activity = (table: string, owners: string, fields: string, key = 'id'): PersonalDataset => ({
  name: `${table}_activity`, table, key, owners: owners.split(' '), columns: fields.split(' '),
});

export const PERSONAL_DATASETS: readonly PersonalDataset[] = [
  entry('office_debt_records', 'studentId', 'id universityId groupId snapshotId studentId subject period basis'),
  entry('office_debt_snapshots', 'verifiedBy', 'id universityId groupId source reference asOfDate verifiedBy createdAt supersededAt'),
  entry('product_activity_days', 'userId', 'id universityId userId day role'),
  entry('users', 'id', 'id email firstName lastName phone avatarUrl role universityId groupId sourceTeacherId maxUserId telegramUserId isActive lastLoginAt createdAt updatedAt'),
  entry('absences', 'studentId', 'id universityId type startDate endDate comment isSensitive confirmationRequired affectedLessonIds affectedLessonsCount source lastSyncedAt sourceVersion syncStatus createdAt updatedAt'),
  entry('attendance_records', 'studentId', 'id universityId lessonId status comment createdAt updatedAt'),
  activity('attendance_records', 'markedById', 'id universityId lessonId status createdAt updatedAt'),
  activity('attendance_qr_sessions', 'createdById', 'id universityId lessonId expiresAt revokedAt createdAt'),
  activity('academic_events', 'actorId hiddenBy', 'id universityId type courseId groupId occurrenceId startsAt endsAt priority hiddenAt createdAt'),
  activity('academic_schedule_changes', 'actorId', 'id universityId occurrenceId legacyLessonId timestamp createdAt'),
  activity('career_company', 'createdBy', 'id createdAt updatedAt'),
  entry('career_membership', 'userId', 'id companyId universityId role revokedAt createdAt updatedAt'),
  activity('career_membership', 'revokedBy', 'id companyId universityId revokedAt'),
  entry('career_profile', 'studentId', 'id universityId headline about skills verification createdAt updatedAt'),
  entry('career_admission', 'studentId', 'id universityId basis skill evidence state reason createdAt updatedAt'),
  entry('career_application', 'studentId', 'id taskId message state createdAt updatedAt'),
  entry('career_task_complaint', 'studentId', 'id universityId taskId studentId category details taskSnapshot state resolution resolvedBy resolvedAt createdAt updatedAt'),
  activity('career_task_complaint', 'resolvedBy', 'id universityId taskId state resolution resolvedBy resolvedAt createdAt updatedAt'),
  entry('career_work', 'studentId', 'id taskId state submission resultUrl decisionReason createdAt updatedAt'),
  entry('career_review', 'authorId', 'id workId rating body publishAllowed createdAt updatedAt'),
  entry('career_portfolio', 'studentId', 'id workId caseText published createdAt updatedAt'),
  entry('career_test_attempt', 'studentId', 'id testId score passed createdAt updatedAt'),
  entry('career_notice', 'userId', 'id title body isRead createdAt updatedAt'),
  entry('career_ai_request', 'userId', 'id kind state createdAt'),
  entry('career_availability', 'studentId', 'studentId universityId weeklyHours timeZone windows blockedDates updatedAt', 'studentId'),
  entry('career_payments', 'createdBy', 'id companyId product receiptEmail amountMinor currency state providerPaymentId refundedMinor checkedAt createdAt updatedAt'),
  entry('career_payment_refunds', 'actorId', 'id paymentId amountMinor state reason createdAt updatedAt'),
  entry('audit_logs', 'userId', 'id action entity entityId ip userAgent createdAt'),
  entry('curator_assignments', 'userId', 'id universityId groupId createdAt revokedAt'),
  activity('curator_assignments', 'grantedBy revokedBy', 'id universityId groupId createdAt revokedAt'),
  entry('user_favorites', 'userId', 'id universityId kind externalId label createdAt updatedAt'),
  entry('device_tokens', 'userId', 'id provider platform deviceName isActive createdAt updatedAt'),
  entry('inbox_items', 'userId', 'id universityId type title description deepLink priority status dueAt completedAt createdAt updatedAt'),
  entry('notification_deliveries', 'userId', 'id universityId notificationId channel status attempts createdAt updatedAt'),
  entry('notification_preferences', 'userId', 'id universityId scheduleChanges cancellations roomChanges homeworkCreated deadlines messages announcements systemAlerts telegramEnabled quietHoursEnabled quietHoursStart quietHoursEnd timeZone updatedAt'),
  entry('notifications', 'userId', 'id universityId type title body deepLink isRead readAt category priority createdAt updatedAt'),
  entry('announcements', 'authorId', 'id pairSpaceId text isPinned createdAt updatedAt'),
  entry('discussion_messages', 'userId', 'id pairSpaceId text parentId moderationState moderationReason moderatedAt createdAt updatedAt'),
  activity('discussion_messages', 'moderatedBy', 'id pairSpaceId moderationState moderatedAt'),
  entry('file_attachments', 'uploadedBy', 'id pairSpaceId fileUrl fileName fileType size revokedAt createdAt'),
  activity('file_attachments', 'revokedBy', 'id pairSpaceId revokedAt'),
  entry('homework_progress', 'studentId', 'id homeworkId state subtasks createdAt updatedAt'),
  entry('homework_submissions', 'studentId', 'id homeworkId status submittedAt fileUrl comment createdAt updatedAt'),
  entry('homeworks', 'authorId', 'id pairSpaceId title description deadline isRecurring recurringRule isCompleted createdAt updatedAt'),
  entry('personal_lesson_notes', 'userId', 'id universityId pairSpaceId content createdAt updatedAt'),
  entry('platform_grants', 'userId', 'userId permissions serviceIds universityIds createdAt updatedAt', 'userId'),
  activity('platform_grants', 'grantedBy', 'createdAt updatedAt', 'userId'),
  entry('office_assignments', 'userId', 'id universityId duty facultyIds groupIds canCreateForStudents revokedAt createdAt'),
  activity('office_assignments', 'assignedBy revokedBy', 'id universityId duty revokedAt createdAt'),
  activity('office_routes', 'configuredBy', 'id universityId groupId type version dueDays updatedAt'),
  { ...entry('office_routes', 'configuredBy', 'id universityId groupId type version dueDays updatedAt'), name: 'assigned_office_routes', owners: [], where: '$1::uuid = ANY(t."assigneeIds")' },
  entry('student_requests', 'studentId', 'id universityId groupId facultyId type status title description dueAt workflowVersion version submittedAt closedAt resultReference createdAt updatedAt'),
  activity('student_requests', 'createdBy assignedTo', 'id universityId type status createdAt updatedAt'),
  activity('request_steps', 'assigneeId decidedBy', 'id universityId requestId sequence duty state dueAt decidedAt'),
  activity('request_decisions', 'actorId', 'id universityId requestId stepId action fromStatus toStatus reason createdAt'),
  activity('request_documents', 'addedBy', 'id universityId requestId attachmentId createdAt'),
  activity('schedule_import_jobs', 'actorId', 'id universityId status attempts nextAttemptAt createdAt updatedAt'),
  activity('lesson_changes', 'changedBy', 'id lessonId changeType source changedAt createdAt'),
  entry('academic_identities', 'userId', 'id universityId sourceBaseUrl externalUserId linkedAt'),
  activity('academic_identities', 'linkedBy', 'id universityId linkedAt'),
  activity('faculties', 'deanUserId', 'id universityId name code createdAt updatedAt'),
  activity('groups', 'curatorId', 'id universityId name createdAt updatedAt'),
  entry('teachers', 'userId', 'id universityId department position createdAt updatedAt'),
  ...[
    entry('lessons', 'teacherId', 'id universityId groupId subject teacherName room building dayOfWeek startTime endTime startDate endDate createdAt updatedAt'),
    entry('lesson_occurrences', 'teacherId', 'id universityId courseId groupId startsAt endsAt room building status createdAt updatedAt'),
    entry('lesson_series', 'teacherId', 'id universityId courseId groupId title dayOfWeek startTime endTime validFrom validTo createdAt updatedAt'),
  ].map(dataset => ({ ...dataset, where: '(t."teacherId"::text = $1 OR EXISTS (SELECT 1 FROM teachers p WHERE p.id::text = t."teacherId"::text AND p."userId"::text = $1 AND p."universityId" = t."universityId"))' + (dataset.table === 'lessons' ? ' OR EXISTS (SELECT 1 FROM users p WHERE p.id::text = $1 AND p."sourceTeacherId" IS NOT NULL AND p."sourceTeacherId" = t."sourceTeacherId" AND p."universityId" = t."universityId")' : '') })),
  // Parent ownership is checked inside SQL; child assignee/author IDs are not exported.
  { ...entry('absence_confirmations', 'curatorId', 'id absenceId status comment confirmedAt createdAt updatedAt'), name: 'own_absence_confirmations', owners: [], where: 'EXISTS (SELECT 1 FROM absences p WHERE p.id = t."absenceId" AND p."studentId" = $1)' },
  activity('absence_confirmations', 'curatorId', 'id absenceId status confirmedAt createdAt updatedAt'),
  { ...entry('request_steps', 'assigneeId', 'id universityId requestId sequence duty state dueAt decidedAt reason'), name: 'own_request_steps', owners: [], where: 'EXISTS (SELECT 1 FROM student_requests p WHERE p.id = t."requestId" AND p."studentId" = $1)' },
  { ...entry('request_decisions', 'actorId', 'id universityId requestId stepId action fromStatus toStatus reason createdAt'), name: 'own_request_decisions', owners: [], where: 'EXISTS (SELECT 1 FROM student_requests p WHERE p.id = t."requestId" AND p."studentId" = $1)' },
  { ...entry('request_documents', 'addedBy', 'id universityId requestId attachmentId createdAt'), name: 'own_request_documents', owners: [], where: 'EXISTS (SELECT 1 FROM student_requests p WHERE p.id = t."requestId" AND p."studentId" = $1)' },
  { ...entry('career_review', 'authorId', 'id workId rating body publishAllowed createdAt updatedAt'), name: 'received_career_reviews', owners: [], where: 'EXISTS (SELECT 1 FROM career_work p WHERE p.id = t."workId" AND p."studentId" = $1)' },
  { ...entry('career_payment_events', 'paymentId', 'id paymentId source providerStatus state createdAt'), name: 'own_payment_events', owners: [], where: 'EXISTS (SELECT 1 FROM career_payments p WHERE p.id = t."paymentId" AND p."createdBy" = $1)' },
  { ...entry('event_records', 'id', 'id type timestamp universityId priority'), name: 'event_activity', owners: [], where: 't.actor->>\'id\' = $1 OR t.recipients @> jsonb_build_array($1::text)' },
];

export const PERSONAL_EXPORT_LIMITATIONS = [
  'Это снимок активной базы НаПаре. Данные внешнего Moodle, содержимое файлов по ссылкам, браузерные копии, резервные копии и архивы внешних сервисов не включены.',
  'Парольные хеши, токены, коды привязки, банковские ссылки подтверждения и ключи повторных запросов исключены.',
  'Полные JSON аудита, событий и импорта, дополнительные payload/actions уведомлений и ошибки доставки исключены: они могут содержать секреты и чужие сведения. Метаданные действий включены.',
  'Идентификаторы других участников не добавляются автоматически. Собственные тексты и доступные отзывы на свои учебные записи включены. Выгрузка не ищет все упоминания человека во всех текстах системы.',
  'Общая конфигурация расписания, курсов и компаний не является личным набором. Данные преподавателя из внешнего источника без проверенной связи с аккаунтом требуют запроса оператору.',
] as const;

/** Every entity needs an export projection or an explicit non-export classification. */
export const PERSONAL_EXPORT_EXCLUDED_TABLES: Record<string, string> = {
  product_analytics_state: 'University-level collection/readiness timestamps and period bounds; no account or actor reference. Own activity days are exported separately.',
  telegram_link_challenges: 'Authentication secrets; no token hashes are downloadable.',
  universities: 'Shared university and secret connector configuration; account carries its university ID.',
  platform_control: 'Shared platform settings; no personal content other than the existing owner reference.',
  academic_courses: 'Shared course catalog, not a personal grade store.',
  course_spaces: 'Shared course workspace metadata.',
  lesson_spaces: 'Shared lesson workspace metadata.',
  pair_spaces: 'Shared lesson content; direct own contributions are exported separately. Unlinked source teacher names need operator review.',
  career_partnership: 'Company/university relationship, not a personal account record.',
  career_task: 'Company-owned task catalog without a person reference.',
  career_test: 'University question bank; exporting it would disclose assessment answers.',
};

export const quoteIdentifier = (name: string): string => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error('Invalid catalog identifier');
  return `"${name}"`;
};
