# Структура проекта — детальная

Точная структура папок и файлов для каждого приложения.

---

## Корень монорепо

```
napare/
├── apps/
│   ├── backend/                    # NestJS API
│   ├── mobile/                     # Flutter
│   ├── web/                        # Next.js
│   └── max-miniapp/                # React + Vite
├── packages/
│   ├── shared/                     # Общие типы, zod-схемы, константы
│   ├── api-client/                 # Сгенерированный API-клиент
│   └── ui/                         # Общие UI-компоненты (web + max)
├── docs/                           # Документация
├── infrastructure/                 # Docker, K8s, Terraform
├── scripts/                        # Утилиты
├── .github/                        # GitHub Actions
├── docker-compose.yml
├── docker-compose.dev.yml
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
├── .env.example
├── .gitignore
├── .eslintrc.json
├── .prettierrc
└── README.md
```

---

## Backend (NestJS)

```
apps/backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts          # @Roles('admin')
│   │   │   └── current-user.decorator.ts   # @CurrentUser()
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── university.guard.ts
│   │   ├── interceptors/
│   │   │   ├── transform.interceptor.ts    # Единый формат ответа
│   │   │   └── logging.interceptor.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts    # Единый формат ошибок
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts
│   │   ├── dto/
│   │   │   ├── pagination.dto.ts
│   │   │   └── id-param.dto.ts
│   │   └── types/
│   │       └── express.d.ts
│   │
│   ├── config/
│   │   ├── database.config.ts
│   │   ├── jwt.config.ts
│   │   ├── redis.config.ts
│   │   ├── s3.config.ts
│   │   └── app.config.ts
│   │
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts              # /api/v1/auth/*
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── local.strategy.ts
│   │   ├── dto/
│   │   │   ├── request-code.dto.ts
│   │   │   ├── verify-code.dto.ts
│   │   │   ├── login.dto.ts
│   │   │   ├── refresh.dto.ts
│   │   │   └── max-auth.dto.ts
│   │   └── interfaces/
│   │       └── jwt-payload.interface.ts
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts             # /api/v1/users/*
│   │   ├── users.service.ts
│   │   ├── entities/
│   │   │   ├── user.entity.ts
│   │   │   └── preference.entity.ts
│   │   └── dto/
│   │       ├── update-profile.dto.ts
│   │       ├── bind-group.dto.ts
│   │       └── user-response.dto.ts
│   │
│   ├── schedule/
│   │   ├── schedule.module.ts
│   │   ├── schedule.controller.ts          # /api/v1/schedule/*
│   │   ├── schedule.service.ts
│   │   ├── change-detector.service.ts
│   │   ├── entities/
│   │   │   ├── lesson.entity.ts
│   │   │   ├── lesson-change.entity.ts
│   │   │   └── university.entity.ts
│   │   ├── connectors/
│   │   │   ├── schedule-connector.interface.ts
│   │   │   ├── normalized-lesson.interface.ts
│   │   │   ├── sibit.connector.ts
│   │   │   ├── excel.connector.ts
│   │   │   └── connector.factory.ts
│   │   └── dto/
│   │       ├── schedule-query.dto.ts
│   │       ├── upload-schedule.dto.ts
│   │       └── schedule-response.dto.ts
│   │
│   ├── pair-space/
│   │   ├── pair-space.module.ts
│   │   ├── pair-space.controller.ts        # /api/v1/pair-spaces/*
│   │   ├── pair-space.service.ts
│   │   ├── entities/
│   │   │   ├── pair-space.entity.ts
│   │   │   ├── announcement.entity.ts
│   │   │   ├── homework.entity.ts
│   │   │   ├── homework-submission.entity.ts
│   │   │   ├── file-attachment.entity.ts
│   │   │   └── discussion-message.entity.ts
│   │   └── dto/
│   │       ├── create-announcement.dto.ts
│   │       ├── create-homework.dto.ts
│   │       ├── submit-homework.dto.ts
│   │       ├── create-message.dto.ts
│   │       └── file-upload.dto.ts
│   │
│   ├── absences/
│   │   ├── absences.module.ts
│   │   ├── absences.controller.ts          # /api/v1/absences/*, /api/v1/curator/*
│   │   ├── absences.service.ts
│   │   ├── entities/
│   │   │   ├── absence-status.entity.ts
│   │   │   └── absence-confirmation.entity.ts
│   │   └── dto/
│   │       ├── create-absence.dto.ts
│   │       ├── confirm-absence.dto.ts
│   │       └── absence-query.dto.ts
│   │
│   ├── notifications/
│   │   ├── notifications.module.ts
│   │   ├── notifications.controller.ts     # /api/v1/notifications/*
│   │   ├── notifications.service.ts
│   │   ├── push.service.ts
│   │   ├── entities/
│   │   │   ├── notification.entity.ts
│   │   │   └── device-token.entity.ts
│   │   └── dto/
│   │       ├── notification-query.dto.ts
│   │       ├── register-token.dto.ts
│   │       └── notification-settings.dto.ts
│   │
│   ├── admin/
│   │   ├── admin.module.ts
│   │   ├── admin.controller.ts             # /api/v1/admin/*
│   │   ├── admin.service.ts
│   │   ├── superadmin.controller.ts        # /api/v1/superadmin/*
│   │   ├── superadmin.service.ts
│   │   └── dto/
│   │       ├── university.dto.ts
│   │       ├── faculty.dto.ts
│   │       ├── group.dto.ts
│   │       ├── assign-roles.dto.ts
│   │       └── stats-query.dto.ts
│   │
│   └── database/
│       ├── database.module.ts
│       └── seed.service.ts
│
├── test/
│   ├── auth/
│   │   ├── registration.e2e-spec.ts
│   │   └── login.e2e-spec.ts
│   ├── schedule/
│   │   ├── schedule-change-detector.spec.ts
│   │   └── schedule.service.spec.ts
│   ├── pair-space/
│   │   └── pair-space.service.spec.ts
│   ├── absences/
│   │   └── absence-validator.spec.ts
│   ├── notifications/
│   │   └── notifications.service.spec.ts
│   └── jest-e2e.json
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
├── package.json
├── Dockerfile
└── .env.example
```

---

## Mobile (Flutter)

```
apps/mobile/
├── lib/
│   ├── main.dart
│   ├── app.dart
│   │
│   ├── core/
│   │   ├── api/
│   │   │   ├── api_client.dart             # Dio + interceptors
│   │   │   ├── api_exception.dart
│   │   │   └── endpoints.dart
│   │   ├── auth/
│   │   │   ├── auth_provider.dart          # Riverpod auth state
│   │   │   └── secure_storage.dart
│   │   ├── router/
│   │   │   ├── app_router.dart             # go_router config
│   │   │   └── route_names.dart
│   │   ├── theme/
│   │   │   ├── app_theme.dart
│   │   │   ├── app_colors.dart
│   │   │   └── app_text_styles.dart
│   │   └── utils/
│   │       ├── date_utils.dart
│   │       └── validators.dart
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── data/
│   │   │   │   └── auth_repository.dart
│   │   │   ├── presentation/
│   │   │   │   ├── screens/
│   │   │   │   │   ├── splash_screen.dart
│   │   │   │   │   ├── welcome_screen.dart
│   │   │   │   │   ├── phone_input_screen.dart
│   │   │   │   │   ├── sms_code_screen.dart
│   │   │   │   │   ├── consent_screen.dart
│   │   │   │   │   ├── university_picker_screen.dart
│   │   │   │   │   ├── group_picker_screen.dart
│   │   │   │   │   └── profile_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       └── phone_input.dart
│   │   │   └── providers/
│   │   │       └── auth_provider.dart
│   │   │
│   │   ├── my_day/
│   │   │   ├── data/
│   │   │   │   └── my_day_repository.dart
│   │   │   ├── presentation/
│   │   │   │   ├── screens/
│   │   │   │   │   └── my_day_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── day_summary_card.dart
│   │   │   │       ├── lesson_card.dart
│   │   │   │       ├── deadline_card.dart
│   │   │   │       ├── absence_chip.dart
│   │   │   │       └── new_content_item.dart
│   │   │   └── providers/
│   │   │       └── my_day_provider.dart
│   │   │
│   │   ├── schedule/
│   │   │   ├── data/
│   │   │   │   └── schedule_repository.dart
│   │   │   ├── presentation/
│   │   │   │   ├── screens/
│   │   │   │   │   ├── schedule_screen.dart
│   │   │   │   │   └── lesson_detail_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── week_view.dart
│   │   │   │       └── day_view.dart
│   │   │   └── providers/
│   │   │       └── schedule_provider.dart
│   │   │
│   │   ├── pair_space/
│   │   │   ├── data/
│   │   │   │   └── pair_space_repository.dart
│   │   │   ├── presentation/
│   │   │   │   ├── screens/
│   │   │   │   │   └── pair_space_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── announcement_card.dart
│   │   │   │       ├── homework_card.dart
│   │   │   │       ├── file_tile.dart
│   │   │   │       └── discussion_bubble.dart
│   │   │   └── providers/
│   │   │       └── pair_space_provider.dart
│   │   │
│   │   ├── absences/
│   │   │   ├── data/
│   │   │   │   └── absence_repository.dart
│   │   │   ├── presentation/
│   │   │   │   ├── screens/
│   │   │   │   │   └── absence_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       └── absence_status_chip.dart
│   │   │   └── providers/
│   │   │       └── absence_provider.dart
│   │   │
│   │   ├── notifications/
│   │   │   ├── data/
│   │   │   │   └── notification_repository.dart
│   │   │   ├── presentation/
│   │   │   │   └── screens/
│   │   │   │       └── notifications_screen.dart
│   │   │   └── providers/
│   │   │       └── notification_provider.dart
│   │   │
│   │   └── profile/
│   │       ├── data/
│   │       │   └── profile_repository.dart
│   │       ├── presentation/
│   │       │   ├── screens/
│   │       │   │   └── profile_screen.dart
│   │       │   └── widgets/
│   │       │       └── avatar_picker.dart
│   │       └── providers/
│   │           └── profile_provider.dart
│   │
│   └── shared/
│       ├── models/
│       │   ├── user.dart
│       │   ├── lesson.dart
│       │   ├── pair_space.dart
│       │   ├── absence.dart
│       │   └── notification.dart
│       ├── widgets/
│       │   ├── loading_skeleton.dart
│       │   ├── empty_state.dart
│       │   ├── error_state.dart
│       │   ├── offline_banner.dart
│       │   └── app_bottom_nav.dart
│       └── extensions/
│           └── context_extensions.dart
│
├── test/
│   ├── features/
│   │   ├── auth/
│   │   │   └── auth_provider_test.dart
│   │   ├── my_day/
│   │   │   └── my_day_provider_test.dart
│   │   └── absences/
│   │       └── absence_validator_test.dart
│   └── shared/
│       └── widgets/
│           └── empty_state_test.dart
│
├── android/
├── ios/
├── pubspec.yaml
├── analysis_options.yaml
├── flutter_test_config.dart
└── README.md
```

---

## Web (Next.js)

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                        # Редирект на /my-day
│   │   ├── globals.css
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (student)/
│   │   │   ├── layout.tsx                  # StudentLayout с nav
│   │   │   ├── my-day/
│   │   │   │   └── page.tsx
│   │   │   ├── schedule/
│   │   │   │   └── page.tsx
│   │   │   ├── pair-space/
│   │   │   │   └── [lessonId]/
│   │   │   │       └── page.tsx
│   │   │   ├── homework/
│   │   │   │   └── page.tsx
│   │   │   └── profile/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (teacher)/
│   │   │   ├── layout.tsx
│   │   │   ├── my-lessons/
│   │   │   │   └── page.tsx
│   │   │   └── pair-space/
│   │   │       └── [lessonId]/
│   │   │           └── page.tsx
│   │   │
│   │   ├── (curator)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   └── group/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (admin)/
│   │   │   ├── layout.tsx
│   │   │   ├── structure/
│   │   │   │   └── page.tsx
│   │   │   ├── schedule/
│   │   │   │   └── page.tsx
│   │   │   ├── users/
│   │   │   │   └── page.tsx
│   │   │   └── stats/
│   │   │       └── page.tsx
│   │   │
│   │   └── api/                             # BFF (если нужен)
│   │       └── v1/
│   │           └── [...path]/
│   │               └── route.ts
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── empty-state.tsx
│   │   │   ├── error-state.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── modal.tsx
│   │   │   └── toast.tsx
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   ├── bottom-nav.tsx
│   │   │   └── page-wrapper.tsx
│   │   ├── schedule/
│   │   │   ├── week-view.tsx
│   │   │   ├── day-view.tsx
│   │   │   └── lesson-card.tsx
│   │   ├── pair-space/
│   │   │   ├── announcement-list.tsx
│   │   │   ├── homework-list.tsx
│   │   │   ├── file-list.tsx
│   │   │   └── discussion.tsx
│   │   ├── absence/
│   │   │   ├── absence-form.tsx
│   │   │   └── absence-dashboard-table.tsx
│   │   └── common/
│   │       ├── offline-banner.tsx
│   │       └── notification-center.tsx
│   │
│   ├── lib/
│   │   ├── api-client.ts                    # Axios + interceptors
│   │   ├── hooks/
│   │   │   ├── use-auth.ts
│   │   │   ├── use-network-state.ts
│   │   │   └── use-pagination.ts
│   │   └── utils/
│   │       ├── date.ts
│   │       └── validators.ts
│   │
│   ├── stores/
│   │   ├── auth-store.ts
│   │   └── theme-store.ts
│   │
│   └── types/
│       ├── api.ts
│       ├── user.ts
│       ├── lesson.ts
│       └── absence.ts
│
├── public/
│   ├── favicon.ico
│   └── logo.svg
│
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── Dockerfile
└── .env.local.example
```

---

## MAX Mini-App (React + Vite)

```
apps/max-miniapp/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   │
│   ├── max/
│   │   ├── sdk.ts                           # Обёртка над MAX Bridge
│   │   ├── auth.ts                          # Авторизация через initData
│   │   └── theme.ts                         # Подстройка под тему MAX
│   │
│   ├── api/
│   │   ├── client.ts                        # Axios + interceptors
│   │   └── endpoints.ts
│   │
│   ├── pages/
│   │   ├── MyDayPage.tsx
│   │   ├── SchedulePage.tsx
│   │   ├── PairSpacePage.tsx
│   │   └── AbsencePage.tsx
│   │
│   ├── components/
│   │   ├── LessonCard.tsx
│   │   ├── DaySummary.tsx
│   │   ├── AbsenceChip.tsx
│   │   ├── DeadlineCard.tsx
│   │   ├── EmptyState.tsx
│   │   └── LoadingSkeleton.tsx
│   │
│   ├── hooks/
│   │   ├── useMax.ts
│   │   └── useApi.ts
│   │
│   └── types/
│       └── index.ts
│
├── index.html                               # Подключение max-web-app.js
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── package.json
└── README.md
```

---

## Packages (Shared)

```
packages/
├── shared/
│   ├── src/
│   │   ├── constants/
│   │   │   ├── roles.ts                     # Роли: STUDENT, TEACHER, ...
│   │   │   ├── absence-types.ts             # Типы отсутствий
│   │   │   ├── notification-types.ts        # Типы уведомлений
│   │   │   └── change-types.ts              # Типы изменений расписания
│   │   ├── types/
│   │   │   ├── user.ts
│   │   │   ├── lesson.ts
│   │   │   ├── pair-space.ts
│   │   │   ├── absence.ts
│   │   │   └── notification.ts
│   │   └── validators/
│   │       ├── phone.ts                     # Валидация телефона +7
│   │       ├── email.ts
│   │       └── common.ts
│   ├── package.json
│   └── tsconfig.json
│
├── api-client/
│   ├── src/
│   │   ├── generated/                       # Из OpenAPI
│   │   ├── client.ts                        # Обёртка
│   │   └── index.ts
│   ├── openapi.json                         # Сгенерированный spec
│   ├── package.json
│   └── tsconfig.json
│
└── ui/
    ├── src/
    │   ├── Button/
    │   │   ├── Button.tsx
    │   │   └── Button.test.tsx
    │   ├── Input/
    │   │   ├── Input.tsx
    │   │   └── Input.test.tsx
    │   ├── Card/
    │   │   └── Card.tsx
    │   ├── Skeleton/
    │   │   └── Skeleton.tsx
    │   └── index.ts
    ├── package.json
    └── tsconfig.json
```
