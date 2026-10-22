export const typeLabels = { absence: 'Отсутствие', transfer: 'Перевод', retake: 'Пересдача' };
export const statusLabels = { draft: 'Черновик', submitted: 'Подано', in_review: 'На согласовании', needs_changes: 'Нужно уточнение', approved: 'Согласовано', rejected: 'Отказано', withdrawn: 'Отозвано', closed: 'Закрыто' };
export const dutyLabels: Record<string, string> = { office: 'Учебный офис', methodologist: 'Методист', dispatcher: 'Диспетчер', curator_or_dean: 'Куратор / деканат', dean: 'Деканат' };
export interface Person { id: string; firstName: string; lastName: string; role?: string }
export interface Group { id: string; name: string; facultyId: string }
export interface Assignment { userName?: string; id: string; userId: string; duty: string; facultyIds: string[]; groupIds: string[]; canCreateForStudents: boolean; revokedAt: string | null }
export interface Route { id: string; groupId: string; type: keyof typeof typeLabels; assigneeIds: string[]; version: number; dueDays: number }
export interface OfficeContext { assignees: Person[]; canManage: boolean; canCreateForStudents: boolean; groups: Group[]; faculties: { id: string; name: string }[]; assignments: Assignment[]; debtSource: { available: boolean; message: string } }
export interface RequestRow { id: string; title: string; type: keyof typeof typeLabels; status: keyof typeof statusLabels; groupId: string; facultyId: string; assignedTo: string | null; dueAt: string | null; version: number; overdue: boolean; createdAt: string }
export interface RequestDetail extends RequestRow { availableActions: string[]; description: string; studentId: string; studentName: string; workflowVersion: number; resultReference: string | null; steps: { id: string; sequence: number; duty: string; assigneeId: string; assigneeName: string; state: string; dueAt: string }[]; history: { id: string; actorName: string; action: string; reason: string; fromStatus: keyof typeof statusLabels; toStatus: keyof typeof statusLabels; createdAt: string }[]; documents: { id: string; attachmentId: string }[] }
export const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Не назначен';
export const nameOf = (person: Person) => `${person.lastName} ${person.firstName}`;
export const controlClass = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-60';
