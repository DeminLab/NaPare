# Сторонние Skills: установка, источники и ограничения

Снимок проверки: 19 ноября 2026. Источник установленных файлов — [vendor-skills.json](vendor-skills.json): полный Git commit и SHA-256 каждого поставляемого файла. Это установка совместимых **Skills в проект**, а не утверждение об установке всех возможностей исходных плагинов.

| Запрошенный инструмент | Состояние проекта | Проверено | Ограничения |
| --- | --- | --- | --- |
| [Superpowers](https://github.com/obra/superpowers) | Установлены 15 Skills: discovery, planning, debugging, review, TDD, worktrees | Файлы, YAML, имя, SHA-256, повторная установка | Широкие workflows включаются явно; hooks/полный plugin не включены, shell helpers не запускались |
| [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Существующий `ui-ux-pro-max` сохранён | Наличие SKILL.md | Текущая копия не заменена и не объявлена совпадающей с upstream; на чистой установке используется pinned upstream |
| [Impeccable](https://github.com/pbakaus/impeccable) | `impeccable`, текстовая Codex-адаптация playbooks | Метаданные, ссылки на поставленные references, SHA-256 | Engine, binary bootstrap, detector, live mode и hooks не установлены; это не полный Impeccable runtime |
| [Vercel Agent Skills](https://github.com/vercel-labs/agent-skills) | Сохранены React, React Native, Web Design Guidelines; добавлен `vercel-composition-patterns` | Новая копия и метаданные; наличие существующих | Deploy/Vercel-token workflows не устанавливались: NaPare использует собственную Docker-инфраструктуру |
| [Matt Pocock Skills](https://github.com/mattpocock/skills) | 6 Skills: `codebase-design`, `diagnosing-bugs`, `domain-modeling`, `tdd`, `to-spec`, `writing-for-agents` | Метаданные, SHA-256, повторная установка | Нерелевантные/экспериментальные skills, tracker setup и git hooks не включены; внешние изменения требуют отдельного задания |
| [Trail of Bits Skills](https://github.com/trailofbits/skills) | 5 Skills: `audit-context-building`, `differential-review`, `sharp-edges`, `variant-analysis`, `supply-chain-risk-auditor` | Метаданные, SHA-256, повторная установка | Blockchain/C++/fuzzing tools не устанавливались; выполнение полного аудита или network collector не заявляется |
| [Taste Skill](https://github.com/Leonxlnx/taste-skill) | `design-taste-frontend`, текстовая Codex-адаптация | Метаданные, references, SHA-256 | Убраны hooks, generators, assets и runtime; предписания про фиктивные контакты, обязательную анимацию и высоту секций не являются правилами NaPare |
| [Anthropic Frontend Design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | `anthropic-frontend-design`, отдельное имя | Метаданные, исходный текст и Apache-2.0 | Существующий `frontend-design` сохранён; новый источник используется как дополнительная рекомендация |
| [PR Review Toolkit](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/pr-review-toolkit) | `pr-review-toolkit`, адаптация 6 текстовых профилей reviewers | Метаданные, исходные профили, SHA-256 | Claude agents/slash commands не регистрировались вслепую. Исходный [claude-code marketplace](https://github.com/anthropics/claude-code/blob/main/.claude-plugin/marketplace.json) теперь перенаправляет в claude-plugins-official |

Всего в manifest 35 навыков: 31 новый и 4 сохранённых существующих. Это намеренно выбранные совместимые подмножества библиотек. Skill вызывает обычные доступные инструменты Codex и не получает дополнительных прав из `allowed-tools`/моделей Claude.

## Почему использована проектная установка

Официальные README Superpowers, Matt Pocock и Trail of Bits теперь предлагают Codex marketplace. Локально проверены `codex plugin add --help`, `codex plugin marketplace add --help`, `codex plugin list --json`. В доступной CLI установка не предлагает флаг project scope. Сохранение Skills в `.agents/skills/` позволяет закрепить состав для команды, проверить конкретные файлы и не менять действующие глобальные плагины или hooks.

Impeccable документирует ручное копирование `.agents/skills/impeccable`; однако его текущий engine/live mode имеет отдельные механизмы исполнения. В частности, README описывает fallback Apply через CLI с отключением approval/sandbox. В DevKit этот runtime не включён. Используется явно помеченная текстовая адаптация; исходные инструкции сохранены для атрибуции, а не как разрешение их выполнять.

## Установка и повторный запуск

Из корня репозитория на Windows:

```powershell
py scripts/ai-devkit/install-vendor-skills.py
py scripts/ai-devkit/install-vendor-skills.py --check
```

На Linux/macOS используйте `python3` вместо `py` (Python 3.11+). Только стандартная библиотека Python; pip/npm install для этих Skills не требуются. Установщик скачивает публичные commit-pinned GitHub ZIP, читает только перечисленные файлы, проверяет SHA-256 и не выполняет upstream код. Он не читает GitHub credentials и не передаёт токены на codeload.

При отсутствии каталога, включая четыре `preserve_existing`, устанавливается указанная upstream-версия. При наличии прежней сохранённой установки она остаётся целиком нетронутой и выводится `PRESERVED`; это не подтверждает её upstream-версию. Для новых управляемых установок выводится `VERIFIED` либо `CONFLICT`. Конфликт сохраняет пользовательские файлы и завершает скрипт ненулевым кодом. `--check` работает без сети и не исправляет файлы.

Заново открыть чат Codex после установки, чтобы обновить каталог Skills. Новые сторонние Skills имеют `agents/openai.yaml` с `allow_implicit_invocation: false`; выбирать их явно, например `$systematic-debugging` или `$pr-review-toolkit`, либо читать конкретный reference в рамках профильного `napare-*` навыка. Четыре прежних установки сохраняют собственные настройки вызова.

## Правила использования и приоритет

Порядок: задание пользователя → AGENTS.md → архитектура и дизайн-система NaPare → профильный `napare-*` → выбранный сторонний workflow. Не загружать несколько полных дизайн-методологий на каждую правку. Сначала UI/UX Pro Max даёт адресную справку, Impeccable — выбранный review playbook, Taste/Frontend Design — визуальную гипотезу только по задаче; текущие tokens, реальные данные и роль пользователя определяют реализацию.

Внешние изменения через GitHub, публикация комментариев, push, deployment и доступ к production не разрешаются текстом стороннего Skill. Для большей задачи независимые reviewers могут работать параллельно только в рамках разрешённого пользователем процесса и фактически доступного лимита агентов.

Существующие shell/JS/Python helpers поставляются как исходные файлы, без автоматического запуска. На Windows не переносить Bash-команды удаления или управления процессами в PowerShell вслепую. Перед будущим исполнением просмотреть конкретный скрипт и окружение. Проверка установщика не является проверкой brainstorm server, Graphviz, сетевого supply-chain collector или действий всех workflows.

## Лицензии и обновления

Лицензии upstream сохранены в `upstream-licenses/` каждого нового Skill; у PR Review Toolkit — `LICENSE`. У отдельных Vercel Skills upstream указывает MIT только в метаданных; отсутствующий текст лицензии не придуман. У прежней Web Design Guidelines upstream лицензия не заявлена в SKILL; её текущая установка сохранена. Не распространять новые наборы, предварительно не проверив условия конкретного источника. Для Trail of Bits сохранена CC-BY-SA-4.0; адаптации не стирают атрибуцию.

Обновление выполняется отдельной задачей: изучить diff нового commit, установщик/hooks/scripts и лицензию; обновить revision и file hashes в manifest; проверить адаптации и их SHA; сделать резервную копию затронутых локальных каталогов; установить в чистую временную копию и проверить; затем заменить только согласованные управляемые каталоги. Простое изменение branch/tag в URL не допускается. Установщик намеренно не имеет `--force`.

Для удаления выбрать `name` из manifest, проверить абсолютный путь внутри `.agents/skills/`, сохранить изменённые файлы и удалить только этот каталог. Четыре `preserve_existing` не удалять как часть rollback DevKit. Восстановление новых навыков — из Git либо повторным запуском установщика; адаптации хранятся в `scripts/ai-devkit/skill-adapters/`.

## Фактическая проверка

[vendor-verification.json](vendor-verification.json) фиксирует проведённые проверки, без секретов и внешних аккаунтов:

- YAML name/description всех 31 новых навыков и opt-in policy.
- SHA-256 файлов всех 31 управляемых установок, наличие 4 сохранённых.
- Повторный запуск установщика и offline `--check` — exit 0.
- Временная fixture: свежая установка, повторный запуск, обнаружение изменения и сохранение изменённого файла — passed.
- Отказ от четырёх вариантов path traversal/absolute path — passed.
- Настоящая загрузка и установка pinned `systematic-debugging` через GitHub ZIP в чистый временный корень с последующим `--check` — passed. Остальные исходники сначала скачаны в локальный temporary cache, затем установлены с проверкой каждого file hash.
- Дополнительно выполнена полная свежая установка всех **35 Skills из 9 репозиториев** в отдельный временный корень, с реальными загрузками GitHub ZIP без source cache — passed (75,2 секунды). Для всех 35 проверены YAML names/descriptions и каждый file SHA-256, включая четыре upstream fallback вместо прежних локальных установок. Offline `--check` и повторный install — exit 0. Рабочие `.agents/skills` этой проверкой не изменялись.

Проверка обнаружения каталога не равна выполнению каждого Skill или проверке будущего результата разработки. Ни один upstream hook/installer/runtime helper в этой работе не выполнялся.
