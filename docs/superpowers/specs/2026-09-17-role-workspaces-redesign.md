# Редизайн рабочих кабинетов NaPare

## Цель

Сделать staff, admin и developer убедительной демонстрацией единой образовательной операционной системы для защиты на хакатоне MAX: не три несвязанных кабинета, а три профессиональные роли вокруг одного учебного процесса.

## Границы

- В объёме: контентные страницы, общие UI-primitives, глобальные design tokens, auth-экраны staff/admin/developer.
- Вне объёма: `apps/web-student/**`, файлы навигации, шапки, аватары и логотипы во всех приложениях, API-контракты, роли, Docker и бизнес-логика.
- Не добавлять зависимости и не менять маршруты.

## Визуальная концепция: Academic Command Center

Общая основа: ясная сетка, белая «бумажная» поверхность, крупные смысловые числа, строгая типографика, неброские академические детали и статусный цвет только там, где нужен сигнал. Все интерактивные элементы сохраняют заметный focus-ring и минимальную высоту 44px.

| Роль | Метафора | Палитра | Что должен увидеть член жюри |
| --- | --- | --- | --- |
| Staff | Пульс учебного дня | небесный blue, teal, amber | преподаватель быстро видит пары, посещаемость и студентов, которым нужна помощь |
| Admin | Картина университета | academic indigo, blue, coral-alert | администратор управляет данными, группами и учебным качеством через понятные метрики |
| Developer | Операционный центр | navy, cyan, violet, emerald-status | команда наблюдает за API, интеграциями и надёжностью продукта |

## Информационная архитектура

### Staff

- Главный экран `today`: hero с датой и ключевым действием, линейная timeline пар, карточки attendance snapshot и attention queue.
- `attendance`, `groups`, `pair-space`, `week`: одинаковые page header, metric rail и table/list surfaces; danger и warning видны без чтения мелкого текста.
- `notifications`, `profile`, `settings`: спокойные single-column settings surfaces с явным состоянием загрузки, ошибки и пустого списка.

### Admin

- `dashboard`: обзор здоровья университета — студенты, активность, посещаемость, риск-группы, ближайшее действие.
- `users`, `groups`, `faculties`, `university`: управленческие таблицы со status chips и контекстными summary cards.
- `schedule-import`, `connectors`: visible stepper, drop-zone, результат импорта и состояние интеграции как отдельные управляемые действия.

### Developer

- `overview`: service health, latency, active incidents и recent changes выше fold.
- `api`, `architecture`, `session`, `notifications`, `docs`: terminal-inspired panels, моноширинные значения только для технических данных, понятные severity colors.
- Тёмная палитра не полагается на массовые `!important`-переопределения для базового контента; surface, borders и text tokens определяют иерархию.

## Компонентная система

- В каждой роли обновить локальные `Card`, `StatCard`, `Badge`, `Button`, `EmptyState`, `RequestState`, `Skeleton` через tokens, без новой UI-библиотеки.
- Добавить role-scoped utilities: hero, metric rail, section header, action card, status dot, responsive table shell.
- Карточки: radius 16px, тонкая border, мягкая shadow только для приоритетных блоков; не использовать декоративные градиенты как фон всех поверхностей.
- Mobile-first: на узком экране metric grid становится 1–2 колонки, таблицы получают горизонтальный scroll container, вторичные детали скрываются, но действия не исчезают.

## Поведение и доступность

- Существующие API hooks, mutation handlers, loading/error/empty states и маршруты сохраняются.
- Не менять заголовки/навигацию, поскольку над ними работает другой разработчик.
- Контраст текстов и status colors не ниже AA; icon-only actions получают aria-label; motion отключается через `prefers-reduced-motion`.

## Проверка

- Для каждого приложения: `tsc --noEmit`, `next build` и существующий lint.
- Для изменённых UI primitives: focused unit/static tests, если в приложении уже есть test harness; иначе typecheck + build + визуальная проверка production страницы.
- Финально: не должно быть изменений в `apps/web-student/**`, `components/navigation/**`, `components/ui/Avatar.tsx` и файлах логотипов.

## Порядок реализации

1. Tokens и reusable primitives для трёх ролей.
2. Hero/overview pages как демонстрационные экраны хакатона.
3. Operational pages и states, затем auth screens.
4. Responsive/accessibility polish, builds и документация.
