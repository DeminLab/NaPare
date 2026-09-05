# Ветвление

## Стратегия

```
main (production)
  ↑ merge (только через PR, ≥1 approval)
develop (staging)
  ↑ merge (автоматически после CI)
feature/xxx (от develop)
  ↑ rebase на develop перед PR
```

---

## Правила

| Правило | main | develop |
|---------|------|---------|
| Require PR | ✅ | ✅ |
| Required reviews | ≥ 1 | ≥ 1 |
| CI must pass | ✅ | ✅ |
| Force push | ❌ | ❌ |
| Linear history | ❌ | ✅ (rebase) |

---

## Workflow

1. Branch от `develop`: `git checkout -b feature/my-feature develop`
2. Разработка + тесты
3. Rebase на develop: `git rebase develop`
4. Push и создать PR в `develop`
5. Review ≥ 1
6. Squash merge
7. Автоматический деплой на staging

---

## Release workflow

1. Из staging → main через PR
2. Требуется ≥ 1 approval
3. Автоматический деплой на production

---

## См. также

- [process/contributing.md](contributing.md) — PR процесс
- [ops/cicd.md](../ops/cicd.md) — pipeline
