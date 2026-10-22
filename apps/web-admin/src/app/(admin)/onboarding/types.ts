export interface University { id: string; name: string; city: string; status: string }
export interface Faculty { id: string; name: string; code?: string }
export interface Group { id: string; name: string; facultyId: string }
export interface Account { id: string; firstName: string; lastName: string; email: string; role: string; isActive: boolean }
export interface Lesson { id: string; groupId: string; teacherId: string | null; teacherName?: string; subject: string; startDate: string }
export interface ImportJob { jobId: string; status: string; lastError?: string | null; result?: { imported: number; updated: number; deleted: number; unchanged: number } }
export const fieldClass = 'min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base font-normal text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600';
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Не удалось выполнить действие. Повторите попытку.';
export function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
