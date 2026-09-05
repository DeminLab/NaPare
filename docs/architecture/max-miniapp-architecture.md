# Архитектура MAX Mini-App (React + Vite)

## Общая структура

```
apps/max-miniapp/src/
├── main.tsx                         # Точка входа
├── App.tsx                          # Корневой компонент
├── index.css                        # Глобальные стили
│
├── max/                             # Интеграция с MAX
│   ├── sdk.ts                       # Обёртка над MAX Bridge
│   ├── auth.ts                      # Авторизация через initData
│   ├── theme.ts                     # Подстройка под тему MAX
│   └── navigation.ts                # Навигация MAX
│
├── api/                             # API клиент
│   ├── client.ts                    # Axios + interceptors
│   ├── endpoints.ts                 # Константы эндпоинтов
│   └── types.ts                     # Типы ответов
│
├── pages/                           # Страницы
│   ├── MyDayPage.tsx                # Мой день
│   ├── SchedulePage.tsx             # Расписание
│   ├── PairSpacePage.tsx            # Пространство пары
│   ├── AbsencePage.tsx              # Отсутствия
│   ├── NotificationsPage.tsx        # Уведомления
│   └── NotFoundPage.tsx             # 404
│
├── components/                      # Компоненты
│   ├── layout/
│   │   ├── AppLayout.tsx            # Основной макет
│   │   ├── Header.tsx               # Шапка
│   │   ├── BottomNav.tsx            # Нижняя навигация
│   │   └── PageContainer.tsx        # Обёртка страницы
│   │
│   ├── ui/
│   │   ├── Button.tsx               # Кнопки
│   │   ├── Card.tsx                 # Карточки
│   │   ├── Badge.tsx                # Бейджи
│   │   ├── Skeleton.tsx             # Скелетоны
│   │   ├── EmptyState.tsx           # Пустые состояния
│   │   ├── ErrorState.tsx           # Состояния ошибок
│   │   └── LoadingSpinner.tsx       # Индикатор загрузки
│   │
│   ├── schedule/
│   │   ├── LessonCard.tsx           # Карточка пары
│   │   ├── DaySchedule.tsx          # Расписание дня
│   │   └── WeekSchedule.tsx         # Расписание недели
│   │
│   ├── pair-space/
│   │   ├── AnnouncementCard.tsx     # Карточка объявления
│   │   ├── HomeworkCard.tsx         # Карточка ДЗ
│   │   ├── FileTile.tsx             # Файл
│   │   └── DiscussionInput.tsx      # Ввод сообщения
│   │
│   ├── absence/
│   │   ├── AbsenceChip.tsx          # Бейдж отсутствия
│   │   └── AbsenceForm.tsx          # Форма создания
│   │
│   └── common/
│       ├── DaySummary.tsx           # Сводка дня
│       ├── DeadlineCard.tsx         # Карточка дедлайна
│       ├── NotificationBadge.tsx    # Бейдж уведомлений
│       └── OfflineBanner.tsx        # Баннер оффлайна
│
├── hooks/                           # Хуки
│   ├── useMax.ts                    # Хук MAX SDK
│   ├── useApi.ts                    # Хук API запросов
│   ├── useAuth.ts                   # Хук авторизации
│   ├── useTheme.ts                  # Хук темы
│   └── useNetwork.ts                # Хук сети
│
├── stores/                          # Zustand stores
│   ├── authStore.ts                 # Состояние авторизации
│   ├── scheduleStore.ts             # Состояние расписания
│   └── uiStore.ts                   # Состояние UI
│
├── types/                           # TypeScript типы
│   ├── index.ts                     # Общие типы
│   ├── api.ts                       # API типы
│   ├── user.ts                      # Пользователь
│   ├── lesson.ts                    # Пара
│   └── max.ts                       # MAX SDK типы
│
└── utils/                           # Утилиты
    ├── date.ts                      # Утилиты дат
    ├── formatters.ts                # Форматирование
    └── constants.ts                 # Константы
```

## Интеграция с MAX

### 1. MAX SDK

```typescript
// max/sdk.ts
import { MAXBridge } from 'max-web-app';

class MaxSDK {
  private bridge: MAXBridge;

  constructor() {
    this.bridge = new MAXBridge();
  }

  async getUser(): Promise<MaxUser> {
    return this.bridge.getUser();
  }

  async getInitData(): Promise<string> {
    return this.bridge.getInitData();
  }

  async openLink(url: string): Promise<void> {
    return this.bridge.openLink(url);
  }

  async close(): Promise<void> {
    return this.bridge.close();
  }

  onEvent(callback: (event: MaxEvent) => void): void {
    this.bridge.onEvent(callback);
  }
}

export const maxSDK = new MaxSDK();
```

### 2. MAX Auth

```typescript
// max/auth.ts
import { maxSDK } from './sdk';
import { apiClient } from '../api/client';

interface MaxAuthResult {
  isAuthenticated: boolean;
  user?: User;
  accessToken?: string;
}

export async function authenticateWithMax(): Promise<MaxAuthResult> {
  try {
    const initData = await maxSDK.getInitData();
    
    const { data } = await apiClient.post('/auth/max', { initData });
    
    return {
      isAuthenticated: true,
      user: data.user,
      accessToken: data.accessToken,
    };
  } catch (error) {
    console.error('MAX auth failed:', error);
    return {
      isAuthenticated: false,
    };
  }
}
```

### 3. MAX Theme

```typescript
// max/theme.ts
import { maxSDK } from './sdk';

interface MaxTheme {
  isDark: boolean;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
}

export function getMaxTheme(): MaxTheme {
  const theme = maxSDK.getTheme();
  
  return {
    isDark: theme.type === 'dark',
    primaryColor: theme.colors.primary,
    backgroundColor: theme.colors.background,
    textColor: theme.colors.text,
  };
}

export function applyMaxTheme(): void {
  const theme = getMaxTheme();
  
  document.documentElement.classList.toggle('dark', theme.isDark);
  document.documentElement.style.setProperty('--primary-color', theme.primaryColor);
  document.documentElement.style.setProperty('--bg-color', theme.backgroundColor);
  document.documentElement.style.setProperty('--text-color', theme.textColor);
}
```

## Паттерны

### 1. Page Component

```tsx
// pages/MyDayPage.tsx
import { useEffect, useState } from 'react';
import { useMax } from '../hooks/useMax';
import { useApi } from '../hooks/useApi';
import { DaySummary } from '../components/common/DaySummary';
import { DeadlineCard } from '../components/common/DeadlineCard';
import { LessonCard } from '../components/schedule/LessonCard';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export function MyDayPage() {
  const { user } = useMax();
  const { get } = useApi();
  const [data, setData] = useState<MyDayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMyDay();
  }, []);

  const loadMyDay = async () => {
    setIsLoading(true);
    try {
      const response = await get('/schedule/my-day');
      setData(response.data);
    } catch (error) {
      console.error('Failed to load my day:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!data || data.lessons.length === 0) {
    return (
      <EmptyState
        icon="calendar"
        title="Сегодня пар нет"
        description="Отдыхайте или проверьте расписание"
      />
    );
  }

  return (
    <div className="space-y-4">
      <DaySummary 
        lessons={data.lessons} 
        changes={data.changes} 
      />
      
      {data.deadlines.length > 0 && (
        <DeadlineCard deadlines={data.deadlines} />
      )}
      
      <div className="space-y-2">
        {data.lessons.map((lesson) => (
          <LessonCard key={lesson.id} lesson={lesson} />
        ))}
      </div>
    </div>
  );
}
```

### 2. Custom Hook

```typescript
// hooks/useMax.ts
import { useState, useEffect } from 'react';
import { maxSDK } from '../max/sdk';
import { authenticateWithMax } from '../max/auth';
import { useAuthStore } from '../stores/authStore';

export function useMax() {
  const { user, isAuthenticated, login, logout } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initMax();
  }, []);

  const initMax = async () => {
    try {
      await maxSDK.ready();
      
      const authResult = await authenticateWithMax();
      
      if (authResult.isAuthenticated && authResult.user && authResult.accessToken) {
        login(authResult.user, authResult.accessToken);
      }
      
      setIsReady(true);
    } catch (error) {
      console.error('MAX init failed:', error);
      setIsReady(true);
    }
  };

  return {
    user,
    isAuthenticated,
    isReady,
    logout,
    openLink: maxSDK.openLink.bind(maxSDK),
    close: maxSDK.close.bind(maxSDK),
  };
}
```

### 3. API Hook

```typescript
// hooks/useApi.ts
import { useCallback } from 'react';
import { apiClient, ApiError } from '../api/client';
import { useAuthStore } from '../stores/authStore';

export function useApi() {
  const { accessToken, logout } = useAuthStore();

  const get = useCallback(async <T>(url: string, params?: Record<string, any>) => {
    try {
      const response = await apiClient.get<T>(url, { params });
      return response.data;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        logout();
      }
      throw error;
    }
  }, [accessToken, logout]);

  const post = useCallback(async <T>(url: string, data?: any) => {
    try {
      const response = await apiClient.post<T>(url, data);
      return response.data;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        logout();
      }
      throw error;
    }
  }, [accessToken, logout]);

  return { get, post };
}
```

## Тестирование

```
apps/max-miniapp/src/__tests__/
├── components/
│   ├── LessonCard.test.tsx
│   ├── DaySummary.test.tsx
│   └── EmptyState.test.tsx
├── hooks/
│   ├── useMax.test.ts
│   └── useApi.test.ts
├── pages/
│   ├── MyDayPage.test.tsx
│   └── SchedulePage.test.tsx
└── max/
    └── auth.test.ts
```

## vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

## tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary-color, #1E3A5F)',
          light: '#2E5A8F',
        },
        accent: '#00B4A6',
        danger: '#E53935',
        warning: '#FB8C00',
        background: 'var(--bg-color, #F7F9FC)',
        surface: '#FFFFFF',
        text: 'var(--text-color, #1A1A2E)',
      },
    },
  },
  plugins: [],
};
```