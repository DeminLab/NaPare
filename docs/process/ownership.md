# Ownership

## Зоны ответственности

| Зона | Владелец | Контрибьюторы |
|------|----------|---------------|
| Backend (NestJS) | CTO | — |
| Mobile (Flutter) | CTO | — |
| Web (Next.js) | CTO | — |
| MAX Mini-App | CTO | — |
| Документация | CEO/Product | CTO |
| Дизайн UI/UX | CEO/Product | — |
| DevOps / Infra | CTO | — |
| Продажи / Онбординг вузов | CEO/Product | — |
| Юридические вопросы | CEO/Product | — |

---

## CODEOWNERS

```
# Backend
/apps/backend/ @cto

# Mobile
/apps/mobile/ @cto

# Web
/apps/web/ @cto

# MAX Mini-App
/apps/max-miniapp/ @cto

# Документация
/docs/ @product @cto

# Инфраструктура
/infrastructure/ @cto
/docker-compose.yml @cto

# Юридическое
/docs/legal/ @product
```

---

## Модули

| Модуль | Владелец |
|--------|----------|
| auth | CTO |
| schedule | CTO |
| pair-space | CTO |
| absences | CTO |
| my-day | CTO |
| notifications | CTO |
| admin | CTO |

При работе в команде > 2 человек — каждому модулю назначить явного владельца.

---

## См. также

- [process/contributing.md](contributing.md) — PR процесс
- [process/definition-of-done.md](definition-of-done.md) — DoD
