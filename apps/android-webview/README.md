# НаПаре для Android

Тонкая оболочка Android WebView для действующего сайта `https://napare.sano.ru`. Android 8.0+ (API 26), compile/target SDK 35, Java 17, Gradle 8.11.1, AGP 8.9.2.

При новом запуске Activity открывается `/login`; перед показом формы удаляются только `accessToken` и `refreshToken` этого сайта. Нужно снова войти по email и паролю. Переход к кабинету определяется существующим серверным входом сайта. Возвращение из браузера, выбора файла и обычное сворачивание не сбрасывают текущую сессию. Поворот экрана сохраняет текущую страницу.

Сайт отображается без адресной строки. Доступны история кнопки «Назад», индикатор загрузки, сетевой экран с повтором, подтверждения JavaScript, системный выбор файлов и сохранение календаря `.ics`. Для календаря используется origin-scoped WebMessageListener AndroidX; старый WebView без этой возможности показывает просьбу обновить Android System WebView. Другие HTTPS-загрузки и внешние ссылки открываются в браузере. Доставка сообщений MAX и browser/OS sharing зависят от установленных приложений и не гарантируются оболочкой.

HTTP и mixed content запрещены; ошибки сертификатов не обходятся. WebView открывает только точный HTTPS-хост `napare.sano.ru`, сторонние ссылки уходят наружу. Нет JavaScriptInterface, доступа к произвольным файлам, разрешений камеры/микрофона, нативного push или нового backend. Приложение требует интернет; это не полноценная офлайн-копия сайта. Изменения сайта не требуют обновления APK.

## Сборка

Нужны Java 17, Android SDK platform 35 и build-tools 35.0.0. Wrapper получает Gradle из официального distribution. Подпись хранится вне репозитория; приватный JSON имеет поля `store` (абсолютный путь keystore), `password`, `alias`. Никогда не коммитить этот JSON или keystore.

```powershell
./scripts/build-android.ps1 -AndroidSdk 'C:/Android/Sdk' -JavaHome 'C:/Program Files/Java/jdk-17' -SigningConfigPath 'C:/private/napare-release.private.json'
```

Команда запускает `assembleRelease`, `lintRelease`, проверяет подпись и копирует APK в игнорируемый `outputs/android`. Сохраните приватный keystore и его пароль: последующие версии с этим applicationId нужно подписывать тем же ключом. Для новой версии увеличьте versionCode и versionName, а также имя артефакта в скрипте.

## Проверки перед распространением

Сборка и Android lint проверяют код, но не доказывают работу на телефоне. На устройстве проверить новый запуск → email/пароль → кабинет своей роли, клавиатуру, поворот, «Назад», выход и повторный вход, потерю сети/повтор, файлы и сохранение `.ics`. Отдельно проверить внешние ссылки. Установка в Google Play и push не входят в эту поставку.

Документация платформы: [WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview), [WebViewCompat](https://developer.android.com/reference/androidx/webkit/WebViewCompat).
