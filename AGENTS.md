# NaPare — instructions for AI contributors

Before analysing, reviewing or changing code, read [AI_CONTEXT.md](AI_CONTEXT.md) and then follow its reading order. Treat this file as the repository-level entry point for autonomous tools.

## Hard boundaries

- Do not change `apps/web-student/**` during the role-workspace redesign.
- Do not change `apps/*/src/components/navigation/**`, `apps/*/src/components/ui/Avatar.tsx`, header implementations or logo assets without explicit approval.
- Preserve API routes/contracts and Docker configuration unless the task explicitly changes them.
- Never commit `.env` files, credentials, diagnostic bundles, build directories, `node_modules` or `.next`.

## Required completion checks

Run the smallest relevant checks first, then the repository guard and lint before claiming completion. See [docs/ai/change-safety.md](docs/ai/change-safety.md).
