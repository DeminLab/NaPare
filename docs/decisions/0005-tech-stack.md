# ADR-0005: Стек технологий

## Статус
Принято

## Контекст
Нужен стек для:
- Mobile: iOS + Android (один код)
- Web: SSR + CSR
- Backend: REST API + WebSocket
- БД: реляционная + кэш

## Решение

### Mobile
| Компонент | Технология | Обоснование |
|-----------|------------|-------------|
| Framework | **Flutter 3.x** | Один код для iOS/Android, нативная производительность |
| State | **Riverpod** | Простой, тестируемый, компиляторная безопасность |
| Router | **go_router** | Декларативная навигация, deep links |
| HTTP | **dio** | Interceptors, retry, cancel |
| Push | **firebase_messaging** | Стандарт для FCM |

### Web
| Компонент | Технология | Обоснование |
|-----------|------------|-------------|
| Framework | **Next.js 14+** | SSR, App Router, отличный DX |
| State | **TanStack Query 5.x** | Кэширование, оптимистичные обновления |
| Styling | **Tailwind CSS 3.x** | Утилитарный CSS, быстрая разработка |

### Backend
| Компонент | Технология | Обоснование |
|-----------|------------|-------------|
| Framework | **NestJS 10+** | Модульный монолит, OpenAPI из коробки |
| ORM | **TypeORM 0.3+** | Миграции, декораторы, интеграция с NestJS |
| Auth | **Passport + JWT** | Стандарт, role-based |
| Validation | **class-validator** | Декларативная валидация |

### База данных
| Компонент | Технология | Обоснование |
|-----------|------------|-------------|
| Основная | **PostgreSQL 16** | Надёжность, JSONB, RLS, полнотекстовый поиск |
| Кэш | **Redis 7** | Сессии, очереди, rate limiting |
| Файлы | **S3-совместимое** | Yandex Object Storage / MinIO |

### Инфраструктура
| Компонент | Технология | Обоснование |
|-----------|------------|-------------|
| Контейнеры | **Docker + Compose** | Локальная разработка |
| CI/CD | **GitHub Actions** | Lint → Test → Build → Deploy |
| Мониторинг | **Sentry + Grafana** | Ошибки + метрики |
| Аналитика | **PostHog** | Продуктовые события |

## Принципы выбора
1. **TypeScript везде** где возможно (web + backend + max-miniapp)
2. **OpenAPI из кода** — генерируется, не рисуется вручную
3. **Мультивузовость** через `university_id`
4. **Минимум зависимостей** — только проверенные библиотеки

## Монорепозиторий
```
napare/
├── apps/
│   ├── backend/        # NestJS
│   ├── mobile/         # Flutter
│   ├── web/            # Next.js
│   └── max-miniapp/    # React + Vite
├── packages/
│   ├── shared/         # Общие типы, константы
│   ├── ui/             # Общие UI-компоненты
│   └── api-client/     # Сгенерированный API-клиент
├── docs/               # Документация
├── infrastructure/     # Docker, K8s
└── scripts/            # Утилиты
```

## Связанные решения
- ADR-0001: Модульный монолит
- ADR-0003: JWT-авторизация
- ADR-0004: OpenAPI как source of truth