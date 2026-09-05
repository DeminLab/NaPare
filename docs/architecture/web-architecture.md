# Архитектура Web (Next.js)

## Общая структура

```
apps/web/src/
├── app/                             # App Router
│   ├── layout.tsx                   # Корневой layout
│   ├── page.tsx                     # Редирект на /my-day
│   ├── globals.css                  # Глобальные стили
│   │
│   ├── (auth)/                      # Группа маршрутов авторизации
│   │   ├── layout.tsx               # Auth layout (без навигации)
│   │   ├── login/
│   │   │   └── page.tsx             # Страница входа
│   │   └── register/
│   │       └── page.tsx             # Страница регистрации
│   │
│   ├── (student)/                   # Группа студента
│   │   ├── layout.tsx               # StudentLayout с навигацией
│   │   ├── my-day/
│   │   │   └── page.tsx             # Мой день
│   │   ├── schedule/
│   │   │   ├── page.tsx             # Расписание
│   │   │   └── [lessonId]/
│   │   │       └── page.tsx         # Детали пары
│   │   ├── pair-space/
│   │   │   └── [lessonId]/
│   │   │       └── page.tsx         # Пространство пары
│   │   ├── homework/
│   │   │   └── page.tsx             # Мои задания
│   │   └── profile/
│   │       └── page.tsx             # Профиль
│   │
│   ├── (teacher)/                   # Группа преподавателя
│   │   ├── layout.tsx               # TeacherLayout
│   │   ├── my-lessons/
│   │   │   └── page.tsx             # Мои пары
│   │   └── pair-space/
│   │       └── [lessonId]/
│   │           └── page.tsx         # Управление пространством
│   │
│   ├── (curator)/                   # Группа куратора
│   │   ├── layout.tsx               # CuratorLayout
│   │   ├── dashboard/
│   │   │   └── page.tsx             # Дашборд отсутствий
│   │   └── group/
│   │       └── page.tsx             # Мои группы
│   │
│   ├── (admin)/                     # Группа админа
│   │   ├── layout.tsx               # AdminLayout с сайдбаром
│   │   ├── structure/
│   │   │   └── page.tsx             # Структура вуза
│   │   ├── schedule/
│   │   │   └── page.tsx             # Управление расписанием
│   │   ├── users/
│   │   │   └── page.tsx             # Управление пользователями
│   │   └── stats/
│   │       └── page.tsx             # Статистика
│   │
│   └── api/                         # BFF (если нужен)
│       └── v1/
│           └── [...path]/
│               └── route.ts
│
├── components/                      # Компоненты
│   ├── ui/                          # Базовые UI компоненты
│   │   ├── button.tsx               # Кнопки
│   │   ├── input.tsx                # Инпуты
│   │   ├── card.tsx                 # Карточки
│   │   ├── skeleton.tsx             # Скелетоны загрузки
│   │   ├── empty-state.tsx          # Пустые состояния
│   │   ├── error-state.tsx          # Состояния ошибок
│   │   ├── badge.tsx                # Бейджи
│   │   ├── avatar.tsx               # Аватары
│   │   ├── modal.tsx                # Модальные окна
│   │   ├── toast.tsx                # Уведомления
│   │   ├── select.tsx               # Выпадающий список
│   │   ├── table.tsx                # Таблицы
│   │   ├── tabs.tsx                 # Вкладки
│   │   └── dropdown.tsx             # Выпадающее меню
│   │
│   ├── layout/                      # Компоненты макета
│   │   ├── sidebar.tsx              # Сайдбар (для десктопа)
│   │   ├── header.tsx               # Шапка
│   │   ├── bottom-nav.tsx           # Нижняя навигация (мобайл)
│   │   ├── page-wrapper.tsx         # Обёртка страницы
│   │   └── auth-guard.tsx           # Защита маршрутов
│   │
│   ├── schedule/                    # Компоненты расписания
│   │   ├── week-view.tsx            # Недельный вид
│   │   ├── day-view.tsx             # Дневной вид
│   │   ├── lesson-card.tsx          # Карточка пары
│   │   ├── lesson-detail.tsx        # Детали пары
│   │   └── schedule-filter.tsx      # Фильтры
│   │
│   ├── pair-space/                  # Компоненты пространства пары
│   │   ├── announcement-list.tsx    # Список объявлений
│   │   ├── announcement-card.tsx    # Карточка объявления
│   │   ├── homework-list.tsx        # Список ДЗ
│   │   ├── homework-card.tsx        # Карточка ДЗ
│   │   ├── file-list.tsx            # Список файлов
│   │   ├── file-upload.tsx          # Загрузка файлов
│   │   ├── discussion.tsx           # Обсуждение
│   │   └── discussion-message.tsx   # Сообщение
│   │
│   ├── absence/                     # Компоненты отсутствий
│   │   ├── absence-form.tsx         # Форма создания
│   │   ├── absence-card.tsx         # Карточка отсутствия
│   │   ├── absence-dashboard-table.tsx # Таблица дашборда
│   │   └── absence-status-badge.tsx # Бейдж статуса
│   │
│   └── common/                      # Общие компоненты
│       ├── offline-banner.tsx       # Баннер оффлайна
│       ├── notification-center.tsx  # Центр уведомлений
│       ├── notification-badge.tsx   # Бейдж уведомлений
│       ├── date-picker.tsx          # Выбор даты
│       ├── search-input.tsx         # Поиск
│       └── confirm-dialog.tsx       # Диалог подтверждения
│
├── lib/                             # Утилиты и сервисы
│   ├── api-client.ts                # Axios + interceptors
│   ├── api-error.ts                 # Кастомные ошибки API
│   ├── hooks/
│   │   ├── use-auth.ts              # Хук авторизации
│   │   ├── use-user.ts              # Хук пользователя
│   │   ├── use-network-state.ts     # Хук сети
│   │   ├── use-pagination.ts        # Хук пагинации
│   │   ├── use-debounce.ts          # Хук debounce
│   │   └── use-local-storage.ts     # Хук localStorage
│   ├── queries/
│   │   ├── use-schedule-query.ts    # Запрос расписания
│   │   ├── use-pair-space-query.ts  # Запрос пространства
│   │   ├── use-absence-query.ts     # Запрос отсутствий
│   │   └── use-notification-query.ts # Запрос уведомлений
│   └── utils/
│       ├── date.ts                  # Утилиты дат
│       ├── validators.ts            # Валидаторы
│       ├── formatters.ts            # Форматирование
│       └── cn.ts                    # Утилита классов
│
├── stores/                          # Zustand stores
│   ├── auth-store.ts                # Состояние авторизации
│   ├── theme-store.ts               # Состояние темы
│   └── ui-store.ts                  # Состояние UI
│
└── types/                           # TypeScript типы
    ├── api.ts                       # API типы
    ├── user.ts                      # Пользователь
    ├── lesson.ts                    # Пара
    ├── pair-space.ts                # Пространство пары
    ├── absence.ts                   # Отсутствие
    └── notification.ts              # Уведомление
```

## Паттерны

### 1. Server Components + Client Components

```tsx
// app/(student)/my-day/page.tsx (Server Component)
import { MyDayContent } from './my-day-content';
import { getMyDayData } from '@/lib/api';

export default async function MyDayPage() {
  const data = await getMyDayData();
  
  return (
    <PageWrapper>
      <MyDayContent initialData={data} />
    </PageWrapper>
  );
}

// app/(student)/my-day/my-day-content.tsx (Client Component)
'use client';

import { useQuery } from '@tanstack/react-query';
import { DaySummaryCard } from '@/components/schedule/day-summary-card';
import { DeadlineCard } from '@/components/pair-space/deadline-card';

interface MyDayContentProps {
  initialData: MyDayData;
}

export function MyDayContent({ initialData }: MyDayContentProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['my-day'],
    queryFn: fetchMyDay,
    initialData,
  });

  if (isLoading) return <MyDaySkeleton />;

  return (
    <div className="space-y-4">
      <DaySummaryCard lessons={data.lessons} />
      <DeadlineCard deadlines={data.deadlines} />
    </div>
  );
}
```

### 2. API Client Pattern

```typescript
// lib/api-client.ts
import axios, { AxiosError } from 'axios';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error: { code: string; message: string; details?: any[] } }>) => {
    if (error.response?.status === 401) {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
            refreshToken,
          });
          setTokens(data.accessToken, data.refreshToken);
          
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return apiClient.request(error.config);
        } catch {
          clearTokens();
          window.location.href = '/login';
        }
      }
    }

    if (error.response?.data?.error) {
      const { code, message, details } = error.response.data.error;
      throw new ApiError(error.response.status, code, message, details);
    }
    
    throw new ApiError(0, 'UNKNOWN', 'Неизвестная ошибка');
  }
);
```

### 3. TanStack Query Pattern

```typescript
// lib/queries/use-schedule-query.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Lesson } from '@/types/lesson';

interface ScheduleParams {
  startDate: string;
  endDate: string;
  groupId?: string;
}

async function fetchSchedule(params: ScheduleParams): Promise<Lesson[]> {
  const { data } = await apiClient.get('/schedule/my', { params });
  return data.data;
}

export function useScheduleQuery(params: ScheduleParams) {
  return useQuery({
    queryKey: ['schedule', params],
    queryFn: () => fetchSchedule(params),
    staleTime: 5 * 60 * 1000, // 5 минут
  });
}
```

### 4. Zustand Store Pattern

```typescript
// stores/auth-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types/user';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: (user, accessToken, refreshToken) =>
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),

      updateUser: (partialUser) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partialUser } : null,
        })),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        refreshToken: state.refreshToken,
      }),
    }
  )
);
```

### 5. Custom Hooks Pattern

```typescript
// lib/hooks/use-auth.ts
'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, login, logout } = useAuthStore();

  const requestCode = async (phone: string) => {
    try {
      const { data } = await apiClient.post('/auth/request-code', { phone });
      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(0, 'UNKNOWN', 'Ошибка отправки кода');
    }
  };

  const verifyCode = async (phone: string, code: string) => {
    try {
      const { data } = await apiClient.post('/auth/verify-code', { phone, code });
      login(data.user, data.accessToken, data.refreshToken);
      router.push('/my-day');
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(0, 'UNKNOWN', 'Ошибка верификации');
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      logout();
      router.push('/login');
    }
  };

  return {
    user,
    isAuthenticated,
    requestCode,
    verifyCode,
    logout: handleLogout,
  };
}
```

### 6. Component Pattern

```tsx
// components/ui/button.tsx
import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-primary text-white hover:bg-primary-light': variant === 'primary',
            'border border-border bg-surface hover:bg-gray-50': variant === 'secondary',
            'hover:bg-gray-100': variant === 'ghost',
            'bg-danger text-white hover:bg-red-600': variant === 'danger',
          },
          {
            'h-8 px-3 text-sm': size === 'sm',
            'h-10 px-4 text-sm': size === 'md',
            'h-12 px-6 text-base': size === 'lg',
          },
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

## Тестирование

```
apps/web/src/__tests__/
├── components/
│   ├── ui/
│   │   ├── button.test.tsx
│   │   └── input.test.tsx
│   ├── schedule/
│   │   └── lesson-card.test.tsx
│   └── pair-space/
│       └── homework-card.test.tsx
├── hooks/
│   ├── use-auth.test.ts
│   └── use-pagination.test.ts
├── lib/
│   ├── api-client.test.ts
│   └── utils/
│       └── date.test.ts
└── pages/
    ├── my-day.test.tsx
    └── schedule.test.tsx
```

## tailwind.config.ts

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1E3A5F',
          light: '#2E5A8F',
        },
        accent: '#00B4A6',
        danger: '#E53935',
        warning: '#FB8C00',
        background: '#F7F9FC',
        surface: '#FFFFFF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
```