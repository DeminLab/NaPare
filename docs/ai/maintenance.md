# Maintaining the AI documentation layer

## Regenerate source coverage

Source cards are intentionally small and tied to real paths. When a source file is added, moved or deleted, add or update its card in `docs/ai/source-cards/` and refresh the source-card index. Keep descriptions and verification commands current; a valid path alone does not validate the prose.

For each documentation change, classify it as current implementation, operational procedure, target/specification, historical record or legal draft. Date snapshots and label future/legacy material so it cannot be mistaken for deployed behavior. Source code, current OpenAPI, migrations, package scripts, workflows and Compose files take precedence over older docs.

## Required checks

```powershell
node scripts/verify-ai-documentation.cjs
node scripts/verify-role-workspace-boundaries.cjs
pnpm lint
pnpm lint:docs
```

The documentation validator checks the minimum Markdown inventory, required entry points and canonical source paths. It does not verify factual freshness or local Markdown links; run a separate link check during broad documentation reviews. Do not lower the count threshold to pass a temporary change.

Keep browser diagnostics in ignored `/output/` and `/.playwright-cli/`; Python `__pycache__` and bytecode are ignored too. Local screenshots can support a dated verification record but must not become required repository links or imply production validation.

Use [the documentation writing guide](documentation-guide.md) when creating or materially revising project documentation. It applies Diátaxis by reader need without requiring a repository-wide folder migration.

## Sharing archive

The shareable archive must exclude `.git`, `node_modules`, `.next`, coverage/build output and local `.env*` files. Keep lockfiles, docs, source, infrastructure and example environment files.

