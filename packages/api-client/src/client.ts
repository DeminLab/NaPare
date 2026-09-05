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
} from './types';

export class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor(baseUrl: string = 'http://localhost:3000/api') {
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

  // My Day
  async getMyDay(): Promise<MyDayResponse> {
    const response = await this.client.get<MyDayResponse>('/my-day');
    return response.data;
  }
}
