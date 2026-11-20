# Проверка Codex и проектных Skills

Дата: 19 ноября 2026, Asia/Omsk. Среда: Windows, PowerShell,
`codex-cli 0.146.0`. Результаты относятся к этой локальной установке.

## Что подтверждено

| Проверка | Результат | Граница доказательства |
| --- | --- | --- |
| TOML двенадцати профилей агентов | Успешно | Синтаксис, имена и обязательные поля; не запуск каждой роли |
| `codex app-server --stdio --strict-config` | Успешно | Сервер стартовал и ответил на `initialize` |
| `config/read` для корня NaPare | Успешно | В effective configuration присутствует project layer `.codex` |
| `skills/list`, `forceReload=true` | Успешно | Обнаружены все 20 `napare-*`, каждый `enabled=true`, `errors=[]` |
| Quick validator проектных Skills | 20/20 | Метаданные и структура, не качество решения произвольной задачи |
| Markdownlint проектных Skills | 20 файлов, 0 ошибок | Markdown разметка |
| Пути источников в проектных Skills | Все существуют | Не означает runtime-проверку каждого модуля |
| Code Reviewer как prompt-role | Успешно | Отдельный read-only CLI сеанс принял инструкции профиля и ответил контрольной строкой |
| Нативный выбор custom role через spawn selector | Не подтверждён | В доступной модели схеме `collaboration.spawn_agent` нет аргумента выбора роли |
| Параллельные субагенты текущей работы | Выполнялись | Делегирование через `task_name` и `message`; это не проверка нативного custom-role selector |

## Обнаружение Skills через app-server

Для проверки использован новый stdio-процесс `codex app-server`, а не список
файлов из проводника. JSON-RPC запросы:

```json
{"id":1,"method":"initialize","params":{"clientInfo":{"name":"napare-devkit-verifier","version":"1.0"},"capabilities":{"experimentalApi":true}}}
{"id":2,"method":"skills/list","params":{"cwds":["C:/Users/home/NaPare"],"forceReload":true}}
{"id":3,"method":"config/read","params":{"cwd":"C:/Users/home/NaPare","includeLayers":true}}
```

Ответ `initialize` успешен. В ответе `skills/list` у каждого из перечисленных
навыков `enabled=true`; список ошибок пуст:

- `napare-1c-integration`
- `napare-accessibility`
- `napare-analytics`
- `napare-architect`
- `napare-backend`
- `napare-code-review`
- `napare-database`
- `napare-design-system`
- `napare-devops`
- `napare-documentation`
- `napare-frontend`
- `napare-mobile`
- `napare-observability`
- `napare-performance`
- `napare-product-manager`
- `napare-qa`
- `napare-release`
- `napare-security`
- `napare-social`
- `napare-ui-ux`

`config/read` показал project layer `C:\Users\home\NaPare\.codex`
вместе с user и system layers. Значения секретов и полный effective config
не печатались и в этот документ не сохранялись. Проверка TOML и чтения
конфигурации не подтверждает доступность настроенных MCP; их проверка отдельная.

## Профили агентов и ограничение runtime

Все 12 файлов `.codex/agents/*.toml` разобраны установленным Python 3.10
через `tomli`. Проверены соответствие `name` имени файла, непустые
`description` и `developer_instructions`, отсутствие overrides модели,
provider, sandbox и approval policy:

```text
chief-architect, code-reviewer, database-engineer, devops-engineer,
performance-engineer, product-manager, qa-engineer, security-engineer,
senior-backend, senior-frontend, technical-writer, ui-ux-designer
```

Два read-only ephemeral CLI smoke-сеанса проверяли возможность выбора
`code-reviewer`. Модель сообщила доступную сигнатуру:

```text
collaboration.spawn_agent(task_name, message, fork_turns, model, reasoning_effort)
```

Аргументы `agent_type` и custom-role selector отсутствуют; модель не запустила
роль и не подменила её другой. Поэтому наличие файлов профилей не объявляется
подтверждённым нативным runtime-discovery всех ролей. Внешнего API перечисления
custom roles в использованной app-server схеме также не найдено.

Рабочий fallback для текущего инструмента: родитель читает конкретный профиль
и передаёт его `developer_instructions` в `message` субагента с соответствующим
`task_name`, дополняя только задачей, границами файлов и acceptance criteria.
Модель и reasoning не меняются. Такой текстовый профиль не создаёт отдельную
техническую изоляцию; действуют разрешения родительского сеанса.

Для отдельного runtime smoke инструкции из
`.codex/agents/code-reviewer.toml` загружены локальным Node-процессом и переданы
в `codex exec` аргументом `-c developer_instructions=<TOML string>`.
Использованы `--strict-config --ignore-user-config --ephemeral -s read-only
--json`; модель, provider и approval policy не переопределялись. Задача запрещала
инструменты и изменения файлов, требовала только контрольный ответ.

Результат: `NAPARE_CODE_REVIEWER_PROMPT_ROLE_OK`, exit code `0`, вызовов
shell/MCP из модельного сеанса не было. Это доказывает выполнение prompt-role
в CLI; качество code review и запуск остальных 11 профилей не проверялись.

## Обнаруженные ограничения и предупреждения

- `python` отсутствует в PATH; доступен `py`, версия Python 3.10. Поэтому
  validator запускался как `py -X utf8 .../quick_validate.py`. В этой версии
  нет стандартного `tomllib`; для TOML использован уже установленный `tomli`.
- CLI предупреждает `Shell snapshot not supported yet for PowerShell`.
  Smoke завершился успешно; поддержка snapshot не объявляется работающей.
- CLI сообщает об отсутствующем/некорректном `plugin.json` у существующего
  глобального `neon-postgres@openai-curated-remote`. Плагин не переустанавливался
  и глобальные настройки не менялись. Этот DevKit smoke не проверяет Neon.
- CLI сокращает описания Skills из-за бюджета 2% контекста Skills. Он при этом
  сообщает, что все Skills доступны. Обнаружение 20 проектных Skills отдельно
  подтверждено `skills/list`; полезно выбирать профильные Skills по задаче.
- Попытка совместить `--ignore-user-config` с одними лишь overrides
  `mcp_servers.<name>.enabled=false` дала `invalid transport` для Context7:
  в этом режиме исходный transport не был загружен. Исправленный smoke
  выполнялся без таких неполных overrides и не обращался к MCP.
- Hooks trust не обходился; глобальные настройки, auth и модели не менялись.
  Push, deployment, рабочая БД и внешние мутации не выполнялись.

## Повторная проверка

После изменения Skills повторите `skills/list` с `forceReload=true`.
После обновления Codex проверьте доступную схему spawn-инструмента: custom
role selector может отличаться. Сохраняйте различие между существованием
TOML, discovery, принятием prompt-role и фактическим выполнением профильной
инженерной задачи. Не переносите этот датированный результат на другую
машину или версию CLI без проверки.
