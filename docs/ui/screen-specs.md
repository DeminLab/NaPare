# Detailed Screen Specifications

Компонентные спецификации всех экранов приложения.

---

## 1. Auth Flow (Регистрация и вход)

### S01. Splash Screen

**Платформы:** Mobile, Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `Logo` | Image | Логотип НаПаре (центрирован) |
| `LoadingIndicator` | CircularProgressIndicator | Индикатор загрузки |
| `VersionText` | Text | "Версия 0.1.0" (мелким шрифтом) |

**Логика:**
- Проверка токена в Secure Storage (mobile) / localStorage (web)
- Если токен валиден → перенаправление на `/my-day`
- Если токен невалиден или отсутствует → перенаправление на `/welcome`
- Таймаут: 3 секунды максимум

**Состояния:**
| Состояние | Визуал |
|-----------|--------|
| Loading | Спиннер + логотип |
| Error (offline) | Логотип + "Нет подключения" |

---

### S02. Welcome Screen

**Платформы:** Mobile, Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `WelcomeImage` | Image | Иллюстрация учебного дня |
| `TitleText` | Text | "НаПаре" |
| `SubtitleText` | Text | "Твой учебный день под контролем" |
| `PhoneButton` | ElevatedButton | "Войти по номеру телефона" |
| `EmailButton` | TextButton | "Войти по email" |
| `MAXButton` | OutlinedButton | "Войти через MAX" (опционально) |
| `PrivacyText` | RichText | "Вход означает согласие с [правилами]" |

**Навигация:**
- `PhoneButton` → `/auth/phone`
- `EmailButton` → `/auth/email`
- `MAXButton` → MAX Bridge auth

---

### S03. Phone Input Screen

**Платформы:** Mobile, Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `BackButton` | IconButton | Назад |
| `TitleText` | Text | "Введите номер телефона" |
| `PhoneField` | TextFormField | +7 (XXX) XXX-XX-XX |
| `ContinueButton` | ElevatedButton | "Продолжить" |
| `ErrorText` | Text | Сообщение об ошибке (скрыт по умолчанию) |

**Валидация:**
- Mask: `+7 (###) ###-##-##`
- Обязательное поле
- Regex: `^\+7\d{10}$`

**Состояния:**
| Состояние | Визуал |
|-----------|--------|
| Empty | ContinueButton disabled |
| Valid | ContinueButton enabled |
| Invalid | ErrorText + красная рамка |
| Loading | ContinueButton + CircularProgressIndicator |

---

### S04. SMS Code Screen

**Платформы:** Mobile, Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `BackButton` | IconButton | Назад |
| `TitleText` | Text | "Введите код из SMS" |
| `SubtitleText` | Text | "Код отправлен на +7 *** 1234567" |
| `CodeFields` | Row<TextField> | 4-6 полей для цифр |
| `VerifyButton` | ElevatedButton | "Подтвердить" |
| `ResendButton` | TextButton | "Отправить повторно (60)" |
| `ErrorText` | Text | "Неверный код" |

**Логика:**
- Автоматическая отправка при заполнении всех полей
- Таймер обратного отсчёта 60 секунд
- Максимум 5 попыток, затем блокировка на 5 минут

**Состояния:**
| Состояние | Визуал |
|-----------|--------|
| Waiting | Кодовые поля, кнопка активна |
| Verifying | CircularProgressIndicator |
| Error | Красный текст + вибрация |
| Rate Limited | "Попробуйте через X минут" |
| Resend Available | "Отправить повторно" |

---

### S05. Consent Screen (ПДн)

**Платформы:** Mobile, Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `TitleText` | Text | "Согласие на обработку данных" |
| `ConsentText` | RichText | Полный текст согласия |
| `AgreeCheckbox` | Checkbox | "Я согласен с условиями" |
| `ContinueButton` | ElevatedButton | "Продолжить" |
| `CancelButton` | TextButton | "Выйти" |

**Логика:**
- Checkbox обязательно отмечен для продолжения
- Текст скроллится если не помещается
- Согласие сохраняется в БД

---

### S06. University Picker Screen

**Платформы:** Mobile, Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `SearchField` | TextField | "Найти свой вуз" |
| `UniversityList` | ListView | Список вузов |
| `UniversityItem` | ListTile | Название + город |
| `NotInListButton` | TextButton | "Моего вуза нет в списке" |

**Логика:**
- Поиск по названию (debounce 300мс)
- Пустое состояние: "Вуз не найден"
- Максимум 10 результатов на странице

---

### S07. Group Picker Screen

**Платформы:** Mobile, Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `FacultyDropdown` | DropdownButton | Выбор факультета |
| `CourseDropdown` | DropdownButton | Выбор курса (1-6) |
| `GroupDropdown` | DropdownButton | Выбор группы |
| `ContinueButton` | ElevatedButton | "Продолжить" |

**Логика:**
- Каскадный выбор: Факультет → Курс → Группа
- Группы загружаются после выбора курса
- Кнопка активна только при выборе группы

---

### S08. Profile Screen (Onboarding)

**Платформы:** Mobile, Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `AvatarPicker` | GestureDetector + CircleAvatar | Выбор аватара |
| `FirstNameField` | TextFormField | Имя |
| `LastNameField` | TextFormField | Фамилия |
| `CompleteButton` | ElevatedButton | "Начать" |

**Валидация:**
- Имя: обязательное, 1-100 символов
- Фамилия: обязательная, 1-100 символов

---

## 2. Student Flow

### S09. My Day (Главный экран)

**Платформы:** Mobile, Web, MAX

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `DateHeader` | Text | "Понедельник, 15 января" |
| `AbsenceChip` | ChoiceChip | Статус отсутствия (если есть) |
| `LessonsSection` | Column | Секция "Пары" |
| `LessonCard` | Card | Карточка пары |
| `DeadlinesSection` | Column | Секция "Горящие дедлайны" |
| `DeadlineCard` | Card | Карточка ДЗ |
| `NewContentSection` | Column | Секция "Новый контент" |
| `ContentItem` | ListTile | Элемент контента |
| `EmptyState` | Column | Пустые состояния |

**LessonCard:**
| Sub-component | Описание |
|---------------|----------|
| `TimeText` | "09:00 - 10:30" |
| `SubjectText` | "Программирование" |
| `RoomText` | "301" |
| `ChangeIndicator` | Badge "Изменено" |
| `PairSpaceIndicator` | Badge с числом уведомлений |

**Состояния:**
| Состояние | Визуал |
|-----------|--------|
| Loading | Skeleton карточек |
| Loaded | Карточки пар |
| Empty | "Сегодня пар нет" + иконка |
| Offline | "Нет подключения" + кэш |

---

### S10. Schedule Screen

**Платформы:** Mobile, Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `WeekSelector` | Row | "< 15-21 января >" |
| `DayTabs` | TabBar | Пн Вт Ср Чт Пт Сб Вс |
| `LessonsList` | ListView | Список пар дня |
| `LessonCard` | Card | Карточка пары |
| `FilterChip` | FilterChip | Фильтр по группе (для curator) |

**WeekSelector:**
- Стрелки для навигации по неделям
- Текущая неделя выделена
- Формат: "15-21 января"

**DayTabs:**
- Горизонтальный скролл
- Текущий день выделен
- Дни без пар серые

---

### S11. Pair Space Screen

**Платформы:** Mobile, Web, MAX

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `AppBar` | AppBar | "Пространство пары" + иконка уведомлений |
| `TabBar` | TabBar | Объявления \| ДЗ \| Файлы \| Обсуждение |
| `TabBarView` | TabBarView | Контент вкладок |
| `FloatingActionButton` | FAB | "+" (для teacher) |

**Вкладка "Объявления":**
| Компонент | Описание |
|-----------|----------|
| `PinnedAnnouncement` | Закреплённое объявление (с иконкой 📌) |
| `AnnouncementCard` | Обычное объявление |
| `EmptyState` | "Нет объявлений" |

**Вкладка "ДЗ":**
| Компонент | Описание |
|-----------|----------|
| `HomeworkCard` | ДЗ с deadline |
| `SubmissionStatus` | Chip "Сдано" / "Не сдано" |
| `EmptyState` | "Нет заданий" |

**Вкладка "Файлы":**
| Компонент | Описание |
|-----------|----------|
| `FileTile` | Иконка + имя + размер |
| `DownloadButton` | Скачать |
| `EmptyState` | "Нет файлов" |

**Вкладка "Обсуждение":**
| Компонент | Описание |
|-----------|----------|
| `MessageBubble` | Сообщение |
| `ReplyIndicator` | Ответ на сообщение |
| `MessageInput` | Поле ввода + отправка |
| `EmptyState` | "Начните обсуждение" |

---

### S12. Absence Screen

**Платформы:** Mobile, Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `TitleText` | Text | "Мой статус" |
| `StatusChip` | Chip | Текущий статус |
| `PeriodSelector` | DateRangePicker | Выбор периода |
| `ReasonDropdown` | DropdownButton | Причина |
| `CommentField` | TextFormField | Комментарий |
| `AffectedLessonsText` | Text | "Будет затронуто: 4 пары" |
| `ConfirmButton` | ElevatedButton | "Отправить" |
| `CancelButton` | TextButton | "Отменить" |

**Статусы (Chip):**
| Статус | Цвет | Текст |
|--------|------|-------|
| learning | Зелёный | "Учусь" |
| sick | Красный | "Болен" |
| work | Синий | "Работаю" |
| other_city | Оранжевый | "В другом городе" |
| other | Серый | "Другая причина" |

---

## 3. Teacher Flow

### T01. My Lessons Screen

**Платформы:** Mobile, Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `DateHeader` | Text | Дата |
| `LessonsList` | ListView | Список пар |
| `LessonCard` | Card | Карточка пары |
| `QuickPublishButton` | IconButton | Быстрая публикация |

**LessonCard (Teacher):**
| Sub-component | Описание |
|---------------|----------|
| `TimeText` | "09:00 - 10:30" |
| `SubjectText` | "Программирование" |
| `GroupText` | "ПМИ-201" |
| `StudentsCount` | "25 студентов" |
| `ContentBadges` | Объявления: 2, ДЗ: 1 |

---

### T02. Pair Space Screen (Teacher)

**Платформы:** Mobile, Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `AppBar` | AppBar | "Пространство пары" |
| `TabBar` | TabBar | Объявления \| ДЗ \| Файлы \| Обсуждение |
| `FloatingActionButton` | FAB | "+" |

**FAB Menu (при нажатии):**
| Действие | Иконка | Экран |
|----------|--------|-------|
| Новое объявление | megaphone | Форма объявления |
| Новое ДЗ | assignment | Форма ДЗ |
| Загрузить файла | upload_file | File picker |

---

### T03. Quick Publish Screen

**Платформы:** Mobile, Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `TypeSelector` | SegmentedButton | Объявление \| ДЗ \| Файл |
| `ContentArea` | Dynamic | В зависимости от типа |
| `SendButton` | ElevatedButton | "Опубликовать" |

**Для объявления:**
| Компонент | Описание |
|-----------|----------|
| `TextInput` | TextField |
| `PinSwitch` | Switch "Закрепить" |

**Для ДЗ:**
| Компонент | Описание |
|-----------|----------|
| `TitleInput` | TextField |
| `DescriptionInput` | TextField |
| `DeadlinePicker` | DateTimePicker |
| `RecurringSwitch` | Switch "Повторяющееся" |

**Для файла:**
| Компонент | Описание |
|-----------|----------|
| `FilePicker` | Выбор файла |
| `PreviewList` | Список выбранных файлов |

---

## 4. Curator Flow

### C01. Absence Dashboard

**Платформы:** Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `TitleText` | Text | "Отсутствия студентов" |
| `FilterRow` | Row | Статус + Дата + Поиск |
| `AbsenceTable` | DataTable | Таблица отсутствий |
| `BulkActions` | Row | Массовые действия |

**FilterRow:**
| Фильтр | Тип | Описание |
|--------|-----|----------|
| StatusFilter | DropdownButton | Все / Ожидают / Подтверждённые / Отклонённые |
| DateFilter | DatePicker | Выбор даты |
| SearchField | TextField | Поиск по ФИО |

**AbsenceTable Columns:**
| Колонка | Описание |
|---------|----------|
| Студент | ФИО + группа |
| Тип | Chip с цветом |
| Период | "15-17 января" |
| Причина | Текст (для чувствительных - скрыт) |
| Статус | Chip |
| Действия | Кнопки |

**Row Actions:**
| Кнопка | Действие |
|--------|----------|
| Подтвердить | Зелёная кнопка |
| Отклонить | Красная кнопка |
| Детали | Открыть модал |

---

### C02. Absence Detail Modal

**Платформы:** Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `StudentInfo` | Column | ФИО, группа, курс |
| `AbsenceInfo` | Column | Тип, период, комментарий |
| `AffectedLessons` | ListView | Затронутые пары |
| `ConfirmButton` | ElevatedButton | "Подтвердить" |
| `RejectButton` | OutlinedButton | "Отклонить" |
| `CommentField` | TextFormField | Комментарий куратора |

---

## 5. Admin Flow

### A01. University Structure Screen

**Платформы:** Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `TabBar` | TabBar | Факультеты \| Группы |
| `AddButton` | FAB | "+ Добавить" |
| `TreeView` | TreeView | Иерархия: Вуз → Факультет → Группа |

**Факультет Card:**
| Sub-component | Описание |
|---------------|----------|
| `NameText` | "Информатика" |
| `DeanText` | "Декан: Петров П.П." |
| `StatsText` | "4 курса, 10 групп" |
| `EditButton` | IconButton |
| `DeleteButton` | IconButton |

**Группа Card:**
| Sub-component | Описание |
|---------------|----------|
| `NameText` | "ПМИ-201" |
| `FacultyText` | "Информатика" |
| `CourseText` | "2 курс" |
| `CuratorText` | "Куратор: Сидорова А.А." |
| `StudentsCount` | "25 студентов" |
| `EditButton` | IconButton |

---

### A02. Schedule Upload Screen

**Платформы:** Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `UploadArea` | DragTarget | Перетащите файл или нажмите |
| `FileInput` | InputFile | Выбор файла |
| `SemesterStart` | DatePicker | Начало семестра |
| `SemesterEnd` | DatePicker | Конец семестра |
| `ColumnMapper` | Table | Маппинг колонок |
| `PreviewTable` | Table | Предпросмотр данных |
| `UploadButton` | ElevatedButton | "Загрузить" |
| `SyncButton` | ElevatedButton | "Синхронизировать" |
| `SyncStatus` | Chip | Статус последнего синка |

**ColumnMapper:**
| Колонка файла | Поле в системе | Тип |
|---------------|----------------|-----|
| Dropdown | subject | text |
| Dropdown | teacher | text |
| Dropdown | room | text |
| Dropdown | group | text |
| Dropdown | dayOfWeek | select |
| Dropdown | startTime | time |
| Dropdown | endTime | time |

---

### A03. Users & Roles Screen

**Платформы:** Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `SearchField` | TextField | Поиск пользователей |
| `RoleFilter` | DropdownButton | Фильтр по роли |
| `UsersTable` | DataTable | Таблица пользователей |
| `RoleEditor` | Modal | Назначение ролей |

**UsersTable Columns:**
| Колонка | Описание |
|---------|----------|
| ФИО | Имя пользователя |
| Контакт | Email / Телефон |
| Роли | Chips ролей |
| Группа | Название группы |
| Последняя активность | Дата |
| Действия | Кнопка "Роли" |

**RoleEditor Modal:**
| Компонент | Описание |
|-----------|----------|
| `UserHeader` | ФИО, контакт |
| `RoleCheckboxes` | Чекбоксы для ролей |
| `GroupSelector` | Выбор группы (для curator) |
| `SaveButton` | "Сохранить" |

---

### A04. Statistics Screen

**Платформы:** Web

**Компоненты:**
| Компонент | Тип | Описание |
|-----------|-----|----------|
| `StatsCards` | Row | Карточки статистики |
| `Chart1` | LineChart | Активные студенты |
| `Chart2` | BarChart | Контент преподавателей |
| `Chart3` | PieChart | Отсутствия |

**StatsCards:**
| Карточка | Значение |
|----------|----------|
| Всего студентов | 500 |
| Активных (30д) | 450 |
| Преподавателей | 30 |
| С контентом | 83% |

---

## 6. Common Components

### `EmptyState`

```dart
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? action;
}
```

**Состояния:**
| Пустое состояние | Иконка | Текст |
|------------------|--------|-------|
| Нет пар | calendar_today | "Сегодня пар нет" |
| Нет ДЗ | assignment | "Нет горящих дедлайнов" |
| Нет контента | folder_open | "Нет нового контента" |
| Нет уведомлений | notifications_none | "Нет уведомлений" |
| Нет отсутствий | event_available | "Нет отсутствий" |
| Нет файлов | folder_open | "Нет файлов" |
| Нет сообщений | chat_bubble_outline | "Начните обсуждение" |

---

### `LoadingSkeleton`

```dart
class LoadingSkeleton extends StatelessWidget {
  final SkeletonType type; // lesson, card, list, table
}
```

**Типы:**
| Тип | Визуал |
|-----|--------|
| lesson | 3 прямоугольника разной длины |
| card | Квадрат + 2 линии |
| list | 5 одинаковых элементов |
| table | 5 строк × 4 столбца |

---

### `OfflineBanner`

```dart
class OfflineBanner extends StatelessWidget {
  final bool isOffline;
}
```

**Визуал:**
- Фиксированная полоса вверху экрана
- Цвет: оранжевый
- Текст: "Нет подключения. Показаны кэшированные данные."
- Исчезает при восстановлении сети

---

### `ErrorState`

```dart
class ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
}
```

**Визуал:**
- Иконка ошибки
- Текст ошибки
- Кнопка "Повторить"

---

### `AppBottomNav`

```dart
class AppBottomNav extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
}
```

**Элементы (Student):**
| Индекс | Иконка | Label | Роут |
|--------|--------|-------|------|
| 0 | today | Мой день | /my-day |
| 1 | calendar_month | Расписание | /schedule |
| 2 | notifications | Уведомления | /notifications |
| 3 | person | Профиль | /profile |

**Элементы (Teacher):**
| Индекс | Иконка | Label | Роут |
|--------|--------|-------|------|
| 0 | today | Мои пары | /my-lessons |
| 1 | calendar_month | Расписание | /schedule |
| 2 | notifications | Уведомления | /notifications |
| 3 | person | Профиль | /profile |

---

## 7. Design Tokens

### Colors

```dart
class AppColors {
  // Primary
  static const primary = Color(0xFF5B5FE6);      // Индиго
  static const primaryLight = Color(0xFF8B8FE8);
  static const primaryDark = Color(0xFF3B3FC6);

  // Background
  static const background = Color(0xFFF8F9FA);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceVariant = Color(0xFFF1F3F5);

  // Text
  static const textPrimary = Color(0xFF212529);
  static const textSecondary = Color(0xFF6C757D);
  static const textHint = Color(0xFFADB5BD);

  // Status
  static const success = Color(0xFF40C057);
  static const warning = Color(0xFFFF922B);
  static const error = Color(0xFFFA5252);
  static const info = Color(0xFF339AF0);

  // Absence types
  static const absenceLearning = Color(0xFF40C057);
  static const absenceSick = Color(0xFFFA5252);
  static const absenceWork = Color(0xFF339AF0);
  static const absenceOtherCity = Color(0xFFFF922B);
  static const absenceOther = Color(0xFF868E96);
}
```

### Typography

```dart
class AppTextStyles {
  // Headers
  static const h1 = TextStyle(fontSize: 24, fontWeight: FontWeight.w700);
  static const h2 = TextStyle(fontSize: 20, fontWeight: FontWeight.w600);
  static const h3 = TextStyle(fontSize: 16, fontWeight: FontWeight.w600);

  // Body
  static const bodyLarge = TextStyle(fontSize: 16, fontWeight: FontWeight.w400);
  static const body = TextStyle(fontSize: 14, fontWeight: FontWeight.w400);
  static const bodySmall = TextStyle(fontSize: 12, fontWeight: FontWeight.w400);

  // Labels
  static const labelLarge = TextStyle(fontSize: 14, fontWeight: FontWeight.w500);
  static const label = TextStyle(fontSize: 12, fontWeight: FontWeight.w500);
  static const labelSmall = TextStyle(fontSize: 10, fontWeight: FontWeight.w500);
}
```

### Spacing

```dart
class AppSpacing {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 24.0;
  static const xxl = 32.0;
}
```

### Border Radius

```dart
class AppBorderRadius {
  static const sm = 4.0;
  static const md = 8.0;
  static const lg = 12.0;
  static const xl = 16.0;
  static const full = 999.0;
}
```
