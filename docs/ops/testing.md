# Тестирование

Сверено с командами репозитория 16 октября 2026. Датированные результаты текущей синхронизации находятся в [отчёте](../project-log/2026-10-16-repository-sync.md).

## Обязательные локальные проверки

Из корня после установки зависимостей:

```powershell
pnpm test:unit
pnpm typecheck
node scripts/verify-role-workspace-boundaries.cjs
node scripts/verify-ai-documentation.cjs
pnpm lint
node --test infrastructure/control/agent.test.mjs
git diff --check
```

`typecheck` охватывает backend, portal и четыре действующих role-приложения. Legacy `apps/web`, `apps/max-miniapp` и Android Gradle в эту команду не входят. Валидатор документации проверяет пути source cards и обязательные точки входа; актуальность текста и Markdown-ссылки проверяются отдельно.

## Интеграционные проверки PostgreSQL

```powershell
pnpm test:e2e
```

Для `curation.e2e-spec.ts` задайте `CURATION_TEST_DATABASE_URL`, для `platform.e2e-spec.ts` — `PLATFORM_TEST_DATABASE_URL`. Используйте только новые отдельные локальные базы с разрешённым fixture-префиксом `curation_test_*`; fixture пересоздаёт схему. Не используйте рабочую БД и не публикуйте URL с паролем. Без переменной соответствующий набор пропускается: skip не означает успешный интеграционный тест.

Проверяются настоящие Nest HTTP, JWT и PostgreSQL. В platform fixture выполнение Docker заменено тестовым исполнителем; для реальных рестартов нужен установленный агент и проверка контейнеров по [операционной инструкции](../deployment/platform-control.md).

## Браузер и Android

В браузере проверяйте вход и роли, загрузку/пустые состояния/ошибки, маршруты, ограничения доступа, кураторство и отзыв прав при открытой странице. Для изменённых экранов нужны мобильная и настольная ширина, клавиатура, отсутствие переполнения и ошибок JavaScript. Скрипты `scripts/test-*.cjs` имеют отдельные предусловия — прочитайте их до запуска; pnpm unit/typecheck не заменяют браузерную проверку.

Android использует независимую Gradle-сборку: `scripts/build-android.ps1` запускает assembleRelease, lintRelease и testReleaseUnitTest. См. [Android README](../../apps/android-webview/README.md). JVM-тесты не доказывают работу Android UI. На устройстве отдельно проверяйте вход, файлы, «Назад», поворот, офлайн-план после полного закрытия/открытия и обновление APK с сохранением данных. Ключи подписи и APK не входят в Git.

## Цели качества

Проценты покрытия, нагрузочные показатели, TalkBack/VoiceOver, доступность и production health требуют отдельных замеров. Не объявляйте их достигнутыми по lint или typecheck. iOS/Flutter-клиента и FCM/APNs delivery сейчас нет; такие сценарии относятся к будущему развитию.

## Связанные документы

- [Критерии готовности](../process/definition-of-done.md)
- [CI/CD](cicd.md)
- [Кураторство](../product/account-curatorship.md)
- [Управление платформой](../product/platform-control.md)
