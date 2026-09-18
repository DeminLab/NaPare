# Maintaining the AI documentation layer

## Regenerate source coverage

Source cards are intentionally small and tied to real paths. When a source file is added, moved or deleted, add or update its card in `docs/ai/source-cards/` and refresh the source-card index.

## Required checks

```powershell
node scripts/verify-ai-documentation.cjs
node scripts/verify-role-workspace-boundaries.cjs
pnpm lint
```

The documentation validator requires at least 200 Markdown files, validates root entry points and rejects cards whose canonical source no longer exists. Do not lower the count threshold to pass a temporary change.

## Sharing archive

The shareable archive must exclude `.git`, `node_modules`, `.next`, coverage/build output and local `.env*` files. Keep lockfiles, docs, source, infrastructure and example environment files.

