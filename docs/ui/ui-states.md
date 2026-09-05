# НаПаре — Состояния UI — Empty / Error / Loading

## 1. Loading States

### 1.1. Скелетоны (предпочтительно спиннерам)

| Компонент | Скелетон |
|-----------|----------|
| Карточка пары | Прямоугольник с закруглёнными углами, пульсирующий градиент |
| Список пар | 3-5 скелетонов карточек |
| Пространство пары | Табы + скелетон контента |
| Таблица куратора | Строки с пульсирующими ячейками |
| ДЗ | Карточка с прогресс-баром |

### 1.2. Время показа

| Время | Поведение |
|-------|-----------|
| ≤ 300 мс | Спиннер не показывать (сразу контент) |
| 300-1000 мс | Лёгкий fade-in |
| > 1000 мс | Скелетон или спиннер |

### 1.3. Пример скелетона (React)

```tsx
// web/src/components/ui/Skeleton.tsx

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      role="status"
      aria-label="Загрузка"
    />
  );
}

// Usage:
<Skeleton className="h-16 w-full rounded-lg" />
```

### 1.4. Пример скелетона (Flutter)

```dart
// mobile/lib/shared/widgets/loading_skeleton.dart

class SkeletonCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: Colors.grey[300]!,
      highlightColor: Colors.grey[100]!,
      child: Container(
        height: 80,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 4,
            ),
          ],
        ),
        child: Row(
          children: [
            Container(width: 4, height: 80, decoration: BoxDecoration(
              color: Colors.white, borderRadius: BorderRadius.horizontal(
                left: Radius.circular(12),
              ),
            )),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SkeletonLine(width: 0.6),
                  const SizedBox(height: 8),
                  SkeletonLine(width: 0.4),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## 2. Empty States

| Экран | Иллюстрация | Текст | Действие |
|-------|-------------|-------|----------|
| Мой день (нет пар) | Календарь с галочкой | «Сегодня пар нет» | «Посмотрите завтра» |
| Мой день (нет дедлайнов) | Чекбокс | «Нет горящих дедлайнов» | — |
| Пространство пары (нет объявлений) | Рупор | «Объявлений пока нет» | — |
| Пространство пары (нет ДЗ) | Документ | «Заданий пока нет» | — |
| Пространство пары (нет файлов) | Папка | «Файлов пока нет» | — |
| Пространство пары (нет обсуждений) | Чат | «Начните обсуждение» | Поле ввода |
| Расписание (пустое) | Календарь | «Расписание пусто» | — |
| Задания (все сданы) | Галочка | «Все задания сданы! 🎉» | — |
| Уведомления (нет) | Колокольчик | «Уведомлений нет» | — |
| Профиль (нет фото) | Аватар с инициалами | «Добавьте фото» | «Загрузить» |
| Отсутствия (нет) | Календарь | «Нет активных отсутствий» | «Установить статус» |
| Поддержка (нет тикетов) | Письмо | «Нет обращений» | «Создать обращение» |

### 2.1. Пример Empty State (React)

```tsx
// web/src/components/common/EmptyState.tsx

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      )}
      {action && (
        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Usage:
<EmptyState
  icon="📅"
  title="Сегодня пар нет"
  action={{ label: 'Посмотрите завтра', onClick: () => navigate('/schedule') }}
/>
```

---

## 3. Error States

| Ошибка | Иконка | Текст | Действие |
|--------|--------|-------|----------|
| Network error | Розетка | «Нет подключения к интернету» | «Повторить» |
| 400 Bad Request | Восклицание | «Неверный запрос» | «Повторить» |
| 401 Unauthorized | Замок | «Сессия истекла» | «Войти снова» |
| 403 Forbidden | Стоп | «Доступ запрещён» | «Написать в поддержку» |
| 404 Not Found | Лупа | «Страница не найдена» | «На главную» |
| 408 Timeout | Часы | «Сервер не отвечает» | «Повторить» |
| 429 Too Many Requests | Знак | «Слишком много запросов» | Таймер повторной попытки |
| 500 Server Error | Шестерёнка | «Что-то пошло не так» | «Повторить» + «Написать в поддержку» |
| 503 Unavailable | Фургон | «Сервис временно недоступен» | «Попробовать позже» |
| File upload error | Файл с крестиком | «Файл не загружен» | «Попробовать снова» |
| Camera error | Камера с крестиком | «Камера недоступна» | «Выбрать из галереи» |

### 3.1. Пример Error State (React)

```tsx
// web/src/components/common/ErrorState.tsx

interface ErrorStateProps {
  statusCode?: number;
  message?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
}

export function ErrorState({ statusCode, message, onRetry, onGoHome }: ErrorStateProps) {
  const defaults: Record<number, { icon: string; text: string }> = {
    400: { icon: '⚠️', text: 'Неверный запрос' },
    401: { icon: '🔒', text: 'Сессия истекла' },
    403: { icon: '🚫', text: 'Доступ запрещён' },
    404: { icon: '🔍', text: 'Страница не найдена' },
    408: { icon: '⏰', text: 'Сервер не отвечает' },
    429: { icon: '📶', text: 'Слишком много запросов' },
    500: { icon: '⚙️', text: 'Что-то пошло не так' },
    503: { icon: '🚐', text: 'Сервис временно недоступен' },
  };

  const error = statusCode ? defaults[statusCode] : { icon: '❌', text: message || 'Произошла ошибка' };

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-4xl mb-4">{error.icon}</div>
      <h3 className="text-lg font-medium text-gray-900">{error.text}</h3>
      <div className="flex gap-3 mt-4">
        {onRetry && (
          <button onClick={onRetry} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            Повторить
          </button>
        )}
        {onGoHome && (
          <button onClick={onGoHome} className="px-4 py-2 border rounded-lg">
            На главную
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## 4. Swipe Gestures

| Экран | Свайп | Действие |
|-------|-------|----------|
| Мой день | Pull-down | Refresh |
| Расписание | Pull-down | Refresh |
| Уведомления | Pull-down | Refresh |
| Уведомления | Swipe-left | Отметить прочитанным |
| Пространство пары | Swipe-right-to-left | Закрепить объявление (преп.) |
| Задания | Swipe-left | Быстрая отметка «Сдано» |
| Профиль | Pull-down | Refresh (данных) |

---

## 5. Long Press Actions

| Экран | Long press | Действия |
|-------|------------|----------|
| Расписание | Long press на паре | «Поделиться» / «Добавить в календарь» |
| Пространство пары | Long press на сообщении | «Ответить» / «Копировать» / «Закрепить» |
| Лента группы | Long press на посте | «Лайк» / «Поделиться» / «Жалоба» |
| Задания | Long press на ДЗ | «Подробнее» / «Поделиться» |
| Профиль | Long press на аватаре | «Изменить фото» / «Удалить» |

---

## 6. Share / Share-Sheet

### 6.1. Что можно делиться

| Элемент | Формат | Содержание |
|---------|--------|------------|
| Пара | Текст + ссылка | «Программирование, 10:00, ауд. 305» |
| ДЗ | Текст + ссылка | «Лабораторная №3, дедлайн 10.09» |
| Объявление | Текст + ссылка | Текст объявления + ссылка |
| Расписание на день | Изображение | Скриншот расписания |
| Статус отсутствия | Текст | «Болен до 10.09» (только для куратора) |

---

## 7. Offline-состояния

| Сценарий | Поведение |
|----------|----------|
| Нет сети | Баннер: «Нет сети. Показаны сохранённые данные» |
| Восстановление сети | Баннер: «Синхронизация...» → «Синхронизировано» |
| Очередь действий | Иконка часов у отложенных действий |
| Конфликт данных | Модал: «Обнаружены конфликты. Как решить?» |

### 7.1. Пример Offline Banner (React)

```tsx
// web/src/components/common/OfflineBanner.tsx

import { useNetworkState } from '@/lib/hooks/use-network-state';

export function OfflineBanner() {
  const online = useNetworkState();

  if (online) return null;

  return (
    <div className="bg-amber-100 text-amber-800 px-4 py-2 text-center text-sm">
      Нет подключения к интернету. Показаны сохранённые данные.
    </div>
  );
}
```

### 7.2. useNetworkState Hook

```typescript
// web/src/lib/hooks/use-network-state.ts

import { useState, useEffect } from 'react';

export function useNetworkState() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
```

---

## 8. Дизайн-токены для состояний

| Токен | Значение | Применение |
|-------|----------|------------|
| `--color-loading-base` | `#E5E7EB` | Скелетон base |
| `--color-loading-highlight` | `#F3F4F6` | Скелетон highlight |
| `--color-empty-text` | `#6B7280` | Empty state текст |
| `--color-error-text` | `#DC2626` | Error state текст |
| `--color-offline-bg` | `#FEF3C7` | Offline banner фон |
| `--color-success-bg` | `#D1FAE5` | Success banner фон |
| `--animation-skeleton` | `pulse 1.5s ease-in-out infinite` | Скелетон анимация |
| `--animation-fade-in` | `opacity 0.3s ease-out` | Fade-in анимация |

---

**Готово к использованию.** Разработчик может скопировать компоненты и токены.
