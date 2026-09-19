import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

import type {
  LoginDto,
  RegisterDto,
  AuthResponse,
  User,
  Lesson,
  PairSpace,
  Announcement,
  Homework,
  Absence,
  Notification,
  MyDayResponse,
  EventEnvelope,
  NotificationPreference,
  InboxItem,
  AcademicPage,
  Course,
  LessonSeries,
  LessonOccurrence,
  LessonSpace,
  CourseSpace,
  AcademicEvent,
  ScheduleChange,
  AcademicEventType,
} from './types';

export class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor(baseUrl: string = '/api/v1') {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth interceptor
    this.client.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });

    // Handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
              const response = await this.client.post('/auth/refresh', {
                refreshToken,
              });

              const { accessToken, refreshToken: newRefreshToken } = response.data;
              this.setTokens(accessToken, newRefreshToken);

              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return this.client(originalRequest);
            }
          } catch {
            this.clearTokens();
            window.location.href = '/login';
          }
        }

        return Promise.reject(error);
      }
    );
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  clearTokens() {
    this.accessToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  // Auth
  async login(data: LoginDto): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/login', data);
    return response.data;
  }

  async register(data: RegisterDto): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/register', data);
    return response.data;
  }

  // Users
  async getMe(): Promise<User> {
    const response = await this.client.get<User>('/users/me');
    return response.data;
  }

  async updateMe(data: Partial<User>): Promise<User> {
    const response = await this.client.patch<User>('/users/me', data);
    return response.data;
  }

  // Schedule
  async getSchedule(date: string, group?: string, teacherId?: string): Promise<Lesson[]> {
    const params = new URLSearchParams({ date });
    if (group) params.append('group', group);
    if (teacherId) params.append('teacherId', teacherId);

    const response = await this.client.get<Lesson[]>(`/schedule?${params.toString()}`);
    return response.data;
  }

  async getScheduleRange(startDate: string, endDate: string): Promise<Lesson[]> {
    const response = await this.client.get<Lesson[]>('/schedule/range', {
      params: { startDate, endDate },
    });
    return response.data;
  }

  async getScheduleChanges(date: string): Promise<Lesson[]> {
    const response = await this.client.get<Lesson[]>('/schedule/changes', {
      params: { date },
    });
    return response.data;
  }

  // PairSpace
  async getPairSpace(id: string): Promise<PairSpace> {
    const response = await this.client.get<PairSpace>(`/pair-space/${id}`);
    return response.data;
  }

  async getPairSpaceByLesson(lessonId: string): Promise<PairSpace> {
    const response = await this.client.get<PairSpace>(`/pair-space/lesson/${lessonId}`);
    return response.data;
  }

  async getAnnouncements(pairSpaceId: string): Promise<Announcement[]> {
    const response = await this.client.get<Announcement[]>(
      `/pair-space/${pairSpaceId}/announcements`
    );
    return response.data;
  }

  async createAnnouncement(
    pairSpaceId: string,
    data: { title: string; content: string; isPinned?: boolean }
  ): Promise<Announcement> {
    const response = await this.client.post<Announcement>(
      `/pair-space/${pairSpaceId}/announcements`,
      data
    );
    return response.data;
  }

  async getHomeworks(pairSpaceId: string): Promise<Homework[]> {
    const response = await this.client.get<Homework[]>(
      `/pair-space/${pairSpaceId}/homeworks`
    );
    return response.data;
  }

  async createHomework(
    pairSpaceId: string,
    data: { title: string; description?: string; deadline?: string }
  ): Promise<Homework> {
    const response = await this.client.post<Homework>(
      `/pair-space/${pairSpaceId}/homeworks`,
      data
    );
    return response.data;
  }

  async completeHomework(homeworkId: string): Promise<Homework> {
    const response = await this.client.post<Homework>(
      `/pair-space/homeworks/${homeworkId}/complete`
    );
    return response.data;
  }

  // Absences
  async getStudentAbsences(studentId: string): Promise<Absence[]> {
    const response = await this.client.get<Absence[]>(`/absences/student/${studentId}`);
    return response.data;
  }

  async getAbsenceStats(studentId: string): Promise<{ total: number; excused: number; unexcused: number }> {
    const response = await this.client.get(`/absences/stats/${studentId}`);
    return response.data;
  }

  async confirmAbsence(absenceId: string): Promise<Absence> {
    const response = await this.client.post<Absence>(`/absences/${absenceId}/confirm`);
    return response.data;
  }

  async excuseAbsence(absenceId: string, reason: string): Promise<Absence> {
    const response = await this.client.post<Absence>(`/absences/${absenceId}/excuse`, {
      reason,
    });
    return response.data;
  }

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    const response = await this.client.get<Notification[]>('/notifications');
    return response.data;
  }

  async getUnreadCount(): Promise<number> {
    const response = await this.client.get<{ count: number }>('/notifications/unread-count');
    return response.data.count;
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await this.client.patch(`/notifications/${id}/read`);
  }

  async markAllNotificationsAsRead(): Promise<void> {
    await this.client.patch('/notifications/read-all');
  }

  async getNotificationPreferences(): Promise<NotificationPreference> {
    const response = await this.client.get<NotificationPreference>('/notifications/preferences');
    return response.data;
  }

  async updateNotificationPreferences(
    data: Partial<Omit<NotificationPreference, 'id' | 'userId' | 'universityId'>>,
  ): Promise<NotificationPreference> {
    const response = await this.client.patch<NotificationPreference>('/notifications/preferences', data);
    return response.data;
  }

  async getInbox(status?: InboxItem['status']): Promise<InboxItem[]> {
    const response = await this.client.get<InboxItem[]>('/notifications/inbox', {
      params: status ? { status } : undefined,
    });
    return response.data;
  }

  async completeInboxItem(id: string): Promise<void> {
    await this.client.patch(`/notifications/inbox/${id}/complete`);
  }

  async snoozeInboxItem(id: string, until: string): Promise<void> {
    await this.client.patch(`/notifications/inbox/${id}/snooze`, { until });
  }

  async getEventsSince(since?: string): Promise<EventEnvelope[]> {
    const response = await this.client.get<EventEnvelope[]>('/events', {
      params: since ? { since } : undefined,
    });
    return response.data;
  }

  subscribeToEvents(
    onEvent: (event: EventEnvelope) => void,
    options: { since?: string; onStatusChange?: (status: 'connecting' | 'open' | 'offline') => void } = {},
  ): () => void {
    const baseUrl = this.client.defaults.baseURL ?? '/api/v1';
    const query = options.since ? `?since=${encodeURIComponent(options.since)}` : '';
    const controller = new AbortController();
    options.onStatusChange?.('connecting');
    void (async () => {
      try {
        const token = this.accessToken ?? (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
        const response = await fetch(`${baseUrl}/events/stream${query}`, {
          headers: token ? { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' } : { Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`Event stream failed: ${response.status}`);
        options.onStatusChange?.('open');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!controller.signal.aborted) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          const messages = buffer.split('\n\n');
          buffer = messages.pop() ?? '';
          for (const message of messages) {
            const data = message.split('\n').find((line) => line.startsWith('data:'))?.slice(5).trim();
            if (!data) continue;
            const event = JSON.parse(data) as EventEnvelope;
            if (event.type !== 'heartbeat') onEvent(event);
          }
        }
        if (!controller.signal.aborted) options.onStatusChange?.('offline');
      } catch {
        if (!controller.signal.aborted) options.onStatusChange?.('offline');
      }
    })();
    return () => controller.abort();
  }

  // My Day
  async getMyDay(): Promise<MyDayResponse> {
    const response = await this.client.get<MyDayResponse>('/my-day');
    return response.data;
  }

  // Academic context
  async getAcademicCourses(params: { page?: number; limit?: number } = {}): Promise<AcademicPage<Course>> {
    const response = await this.client.get<AcademicPage<Course>>('/academic/courses', { params });
    return response.data;
  }

  async getAcademicCourse(id: string): Promise<Course> {
    const response = await this.client.get<Course>(`/academic/courses/${id}`);
    return response.data;
  }

  async createAcademicCourse(data: { code: string; name: string; facultyId?: string; description?: string; credits?: number }): Promise<Course> {
    const response = await this.client.post<Course>('/academic/courses', data);
    return response.data;
  }

  async updateAcademicCourse(id: string, data: Partial<{ code: string; name: string; facultyId: string; description: string; credits: number }>): Promise<Course> {
    const response = await this.client.patch<Course>(`/academic/courses/${id}`, data);
    return response.data;
  }

  async getCourseSpace(courseId: string): Promise<CourseSpace> {
    const response = await this.client.get<CourseSpace>(`/academic/courses/${courseId}/space`);
    return response.data;
  }

  async getLessonSeries(courseId: string, params: { page?: number; limit?: number } = {}): Promise<AcademicPage<LessonSeries>> {
    const response = await this.client.get<AcademicPage<LessonSeries>>(`/academic/courses/${courseId}/series`, { params });
    return response.data;
  }

  async createLessonSeries(courseId: string, data: {
    groupId: string;
    teacherId?: string;
    title?: string;
    subjectType?: string;
    recurrenceRule?: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    pairNumber: number;
    weekType?: 'both' | 'odd' | 'even';
    room?: string;
    building?: string;
    validFrom: string;
    validTo?: string;
  }): Promise<LessonSeries> {
    const response = await this.client.post<LessonSeries>(`/academic/courses/${courseId}/series`, data);
    return response.data;
  }

  async getLessonOccurrences(params: { courseId?: string; groupId?: string; from?: string; to?: string; page?: number; limit?: number } = {}): Promise<AcademicPage<LessonOccurrence>> {
    const response = await this.client.get<AcademicPage<LessonOccurrence>>('/academic/occurrences', { params });
    return response.data;
  }

  async getLessonOccurrenceContext(id: string): Promise<{ course: Course; series: LessonSeries; occurrence: LessonOccurrence }> {
    const response = await this.client.get(`/academic/occurrences/${id}/context`);
    return response.data;
  }

  async getLessonSpace(occurrenceId: string): Promise<LessonSpace> {
    const response = await this.client.get<LessonSpace>(`/academic/occurrences/${occurrenceId}/space`);
    return response.data;
  }

  async createLessonOccurrence(seriesId: string, data: { startsAt: string; endsAt: string; room?: string; building?: string; status?: LessonOccurrence['status']; changeReason?: string }): Promise<LessonOccurrence> {
    const response = await this.client.post<LessonOccurrence>(`/academic/series/${seriesId}/occurrences`, data);
    return response.data;
  }

  async updateLessonOccurrence(id: string, data: Partial<{ startsAt: string; endsAt: string; room: string; building: string; status: LessonOccurrence['status']; changeReason: string }>): Promise<LessonOccurrence> {
    const response = await this.client.patch<LessonOccurrence>(`/academic/occurrences/${id}`, data);
    return response.data;
  }

  async getOccurrenceScheduleChanges(id: string, params: { page?: number; limit?: number } = {}): Promise<AcademicPage<ScheduleChange>> {
    const response = await this.client.get<AcademicPage<ScheduleChange>>(`/academic/occurrences/${id}/changes`, { params });
    return response.data;
  }

  async getAcademicEvents(params: { type?: AcademicEventType; courseId?: string; groupId?: string; from?: string; to?: string; page?: number; limit?: number } = {}): Promise<AcademicPage<AcademicEvent>> {
    const response = await this.client.get<AcademicPage<AcademicEvent>>('/academic/events', { params });
    return response.data;
  }

  async createAcademicEvent(data: { type: AcademicEventType; title: string; description?: string; courseId?: string; groupId?: string; occurrenceId?: string; startsAt?: string; endsAt?: string }): Promise<AcademicEvent> {
    const response = await this.client.post<AcademicEvent>('/academic/events', data);
    return response.data;
  }
}
