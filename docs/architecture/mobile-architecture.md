# Архитектура Mobile (Flutter)

## Общая структура

```
apps/mobile/lib/
├── main.dart                        # Точка входа
├── app.dart                         # Корневой виджет
│
├── core/                            # Ядро приложения
│   ├── api/
│   │   ├── api_client.dart          # Dio + interceptors
│   │   ├── api_exception.dart       # Кастомные ошибки
│   │   ├── api_interceptor.dart     # Auth interceptor
│   │   └── endpoints.dart           # Константы эндпоинтов
│   ├── auth/
│   │   ├── auth_provider.dart       # Riverpod auth state
│   │   ├── auth_repository.dart     # Репозиторий авторизации
│   │   └── secure_storage.dart      # Хранение токенов
│   ├── router/
│   │   ├── app_router.dart          # go_router конфигурация
│   │   ├── route_names.dart         # Константы маршрутов
│   │   └── route_guards.dart        # Auth guard
│   ├── theme/
│   │   ├── app_theme.dart           # Тема приложения
│   │   ├── app_colors.dart          # Цвета
│   │   ├── app_text_styles.dart     # Стили текста
│   │   └── app_spacing.dart         # Отступы
│   ├── network/
│   │   ├── network_info.dart        # Проверка сети
│   │   └── connectivity_service.dart # Сервис подключения
│   ├── cache/
│   │   ├── cache_manager.dart       # Управление кэшем
│   │   └── cache_config.dart        # Настройки кэша
│   └── utils/
│       ├── date_utils.dart          # Утилиты дат
│       ├── validators.dart          # Валидаторы
│       └── extensions.dart          # Расширения
│
├── features/                        # Feature-based структура
│   ├── auth/
│   │   ├── data/
│   │   │   ├── auth_repository.dart
│   │   │   └── auth_api.dart
│   │   ├── presentation/
│   │   │   ├── screens/
│   │   │   │   ├── splash_screen.dart
│   │   │   │   ├── welcome_screen.dart
│   │   │   │   ├── phone_input_screen.dart
│   │   │   │   ├── sms_code_screen.dart
│   │   │   │   ├── consent_screen.dart
│   │   │   │   ├── university_picker_screen.dart
│   │   │   │   ├── group_picker_screen.dart
│   │   │   │   └── profile_screen.dart
│   │   │   └── widgets/
│   │   │       ├── phone_input.dart
│   │   │       └── code_input.dart
│   │   └── providers/
│   │       ├── auth_provider.dart
│   │       └── onboarding_provider.dart
│   │
│   ├── my_day/
│   │   ├── data/
│   │   │   ├── my_day_repository.dart
│   │   │   └── my_day_api.dart
│   │   ├── presentation/
│   │   │   ├── screens/
│   │   │   │   └── my_day_screen.dart
│   │   │   └── widgets/
│   │   │       ├── day_summary_card.dart
│   │   │       ├── lesson_card.dart
│   │   │       ├── deadline_card.dart
│   │   │       ├── absence_chip.dart
│   │   │       └── new_content_item.dart
│   │   └── providers/
│   │       └── my_day_provider.dart
│   │
│   ├── schedule/
│   │   ├── data/
│   │   │   ├── schedule_repository.dart
│   │   │   └── schedule_api.dart
│   │   ├── presentation/
│   │   │   ├── screens/
│   │   │   │   ├── schedule_screen.dart
│   │   │   │   └── lesson_detail_screen.dart
│   │   │   └── widgets/
│   │   │       ├── week_view.dart
│   │   │       ├── day_view.dart
│   │   │       └── lesson_tile.dart
│   │   └── providers/
│   │       └── schedule_provider.dart
│   │
│   ├── pair_space/
│   │   ├── data/
│   │   │   ├── pair_space_repository.dart
│   │   │   └── pair_space_api.dart
│   │   ├── presentation/
│   │   │   ├── screens/
│   │   │   │   └── pair_space_screen.dart
│   │   │   └── widgets/
│   │   │       ├── announcement_card.dart
│   │   │       ├── homework_card.dart
│   │   │       ├── file_tile.dart
│   │   │       ├── discussion_bubble.dart
│   │   │       └── tab_bar.dart
│   │   └── providers/
│   │       └── pair_space_provider.dart
│   │
│   ├── absences/
│   │   ├── data/
│   │   │   ├── absence_repository.dart
│   │   │   └── absence_api.dart
│   │   ├── presentation/
│   │   │   ├── screens/
│   │   │   │   └── absence_screen.dart
│   │   │   └── widgets/
│   │   │       ├── absence_status_chip.dart
│   │   │       └── absence_form.dart
│   │   └── providers/
│   │       └── absence_provider.dart
│   │
│   ├── notifications/
│   │   ├── data/
│   │   │   ├── notification_repository.dart
│   │   │   └── notification_api.dart
│   │   ├── presentation/
│   │   │   ├── screens/
│   │   │   │   └── notifications_screen.dart
│   │   │   └── widgets/
│   │   │       └── notification_tile.dart
│   │   └── providers/
│   │       └── notification_provider.dart
│   │
│   └── profile/
│       ├── data/
│       │   ├── profile_repository.dart
│       │   └── profile_api.dart
│       ├── presentation/
│       │   ├── screens/
│       │   │   └── profile_screen.dart
│       │   └── widgets/
│       │       ├── avatar_picker.dart
│       │       └── settings_tile.dart
│       └── providers/
│           └── profile_provider.dart
│
└── shared/                          # Общие компоненты
    ├── models/
    │   ├── user.dart
    │   ├── lesson.dart
    │   ├── pair_space.dart
    │   ├── absence.dart
    │   └── notification.dart
    ├── widgets/
    │   ├── loading_skeleton.dart
    │   ├── empty_state.dart
    │   ├── error_state.dart
    │   ├── offline_banner.dart
    │   ├── app_bottom_nav.dart
    │   └── app_app_bar.dart
    └── extensions/
        └── context_extensions.dart
```

## Паттерны

### 1. Feature-based Architecture

Каждая фича изолирована и содержит:
- `data/` — репозитории и API клиенты
- `presentation/` — экраны и виджеты
- `providers/` — Riverpod провайдеры

### 2. Repository Pattern

```dart
// features/auth/data/auth_repository.dart
abstract class AuthRepository {
  Future<AuthResult> requestCode(String phone);
  Future<AuthResult> verifyCode(String phone, String code);
  Future<AuthResult> refreshTokens(String refreshToken);
  Future<void> logout();
}

// features/auth/data/auth_repository_impl.dart
class AuthRepositoryImpl implements AuthRepository {
  final AuthApi _api;
  final SecureStorage _storage;

  AuthRepositoryImpl(this._api, this._storage);

  @override
  Future<AuthResult> requestCode(String phone) async {
    final response = await _api.requestCode(phone);
    return response;
  }

  @override
  Future<AuthResult> verifyCode(String phone, String code) async {
    final result = await _api.verifyCode(phone, code);
    await _storage.saveTokens(result.accessToken, result.refreshToken);
    return result;
  }
}
```

### 3. Provider Pattern (Riverpod)

```dart
// features/auth/providers/auth_provider.dart
@riverpod
class Auth extends _$Auth {
  @override
  AuthState build() {
    return AuthState.initial();
  }

  Future<void> requestCode(String phone) async {
    state = state.copyWith(isLoading: true);
    try {
      final result = await ref.read(authRepositoryProvider).requestCode(phone);
      state = state.copyWith(
        isLoading: false,
        phone: phone,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  Future<void> verifyCode(String code) async {
    state = state.copyWith(isLoading: true);
    try {
      final result = await ref.read(authRepositoryProvider).verifyCode(
        state.phone!,
        code,
      );
      state = state.copyWith(
        isLoading: false,
        isAuthenticated: true,
        user: result.user,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }
}

// features/auth/providers/auth_provider.g.dart (auto-generated)
```

### 4. API Client Pattern

```dart
// core/api/api_client.dart
class ApiClient {
  final Dio _dio;
  final SecureStorage _storage;

  ApiClient(this._dio, this._storage) {
    _dio.interceptors.addAll([
      AuthInterceptor(_storage),
      LogInterceptor(requestBody: true, responseBody: true),
    ]);
  }

  Future<T> get<T>(String path, {Map<String, dynamic>? queryParameters}) async {
    try {
      final response = await _dio.get(path, queryParameters: queryParameters);
      return response.data as T;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  ApiException _handleError(DioException e) {
    if (e.response?.data != null) {
      final error = e.response!.data['error'];
      return ApiException(
        statusCode: e.response!.statusCode!,
        code: error['code'],
        message: error['message'],
      );
    }
    return ApiException(
      statusCode: 0,
      code: 'UNKNOWN',
      message: 'Неизвестная ошибка',
    );
  }
}
```

### 5. Model Pattern

```dart
// shared/models/user.dart
class User {
  final String id;
  final String? phone;
  final String? email;
  final String firstName;
  final String lastName;
  final String? avatarUrl;
  final List<String> roles;
  final String universityId;
  final String? groupId;
  final DateTime createdAt;

  const User({
    required this.id,
    this.phone,
    this.email,
    required this.firstName,
    required this.lastName,
    this.avatarUrl,
    required this.roles,
    required this.universityId,
    this.groupId,
    required this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      phone: json['phone'],
      email: json['email'],
      firstName: json['firstName'],
      lastName: json['lastName'],
      avatarUrl: json['avatarUrl'],
      roles: List<String>.from(json['roles']),
      universityId: json['universityId'],
      groupId: json['groupId'],
      createdAt: DateTime.parse(json['createdAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'phone': phone,
      'email': email,
      'firstName': firstName,
      'lastName': lastName,
      'avatarUrl': avatarUrl,
      'roles': roles,
      'universityId': universityId,
      'groupId': groupId,
      'createdAt': createdAt.toIso8601String(),
    };
  }
}
```

### 6. Router Pattern

```dart
// core/router/app_router.dart
@riverpod
GoRouter appRouter(AppRouterRef ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final isAuthenticated = authState.isAuthenticated;
      final isOnboarding = state.matchedLocation == '/onboarding';

      if (!isAuthenticated && !isOnboarding) {
        return '/welcome';
      }

      if (isAuthenticated && isOnboarding) {
        return '/my-day';
      }

      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (context, state) => const SplashScreen()),
      GoRoute(path: '/welcome', builder: (context, state) => const WelcomeScreen()),
      GoRoute(path: '/my-day', builder: (context, state) => const MyDayScreen()),
      // ... другие маршруты
    ],
  );
}
```

## Навигация

### Bottom Navigation (Студент)

```dart
// shared/widgets/app_bottom_nav.dart
class AppBottomNav extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const AppBottomNav({
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return BottomNavigationBar(
      currentIndex: currentIndex,
      onTap: onTap,
      items: const [
        BottomNavigationBarItem(
          icon: Icon(Icons.today),
          label: 'Мой день',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.calendar_today),
          label: 'Расписание',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.assignment),
          label: 'Задания',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.person),
          label: 'Профиль',
        ),
      ],
    );
  }
}
```

## Состояния

```dart
// features/my_day/providers/my_day_provider.dart
@riverpod
class MyDay extends _$MyDay {
  @override
  MyDayState build() {
    return MyDayState.initial();
  }

  Future<void> loadMyDay() async {
    state = state.copyWith(isLoading: true);
    try {
      final data = await ref.read(myDayRepositoryProvider).getMyDay();
      state = state.copyWith(
        isLoading: false,
        lessons: data.lessons,
        changes: data.changes,
        deadlines: data.deadlines,
        newContent: data.newContent,
        absenceStatus: data.absenceStatus,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }
}

// features/my_day/providers/my_day_provider.g.dart (auto-generated)
```

## Тестирование

```
apps/mobile/test/
├── features/
│   ├── auth/
│   │   ├── auth_repository_test.dart
│   │   ├── auth_provider_test.dart
│   │   └── auth_screens_test.dart
│   ├── my_day/
│   │   ├── my_day_repository_test.dart
│   │   ├── my_day_provider_test.dart
│   │   └── my_day_screen_test.dart
│   └── absences/
│       ├── absence_repository_test.dart
│       └── absence_validator_test.dart
└── shared/
    ├── widgets/
    │   ├── empty_state_test.dart
    │   └── error_state_test.dart
    └── models/
        └── user_test.dart
```

## pubspec.yaml (зависимости)

```yaml
dependencies:
  flutter_riverpod: ^2.0.0
  riverpod_annotation: ^2.0.0
  go_router: ^14.0.0
  dio: ^5.0.0
  flutter_secure_storage: ^9.0.0
  firebase_core: ^3.0.0
  firebase_messaging: ^15.0.0
  cached_network_image: ^3.0.0
  intl: ^0.19.0
  json_annotation: ^4.8.0
  equatable: ^2.0.0
  connectivity_plus: ^5.0.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  riverpod_generator: ^2.0.0
  build_runner: ^2.4.0
  json_serializable: ^6.7.0
  mockito: ^5.4.0
  build_verify: ^3.1.0