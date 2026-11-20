# NaPare — instructions for AI contributors

Read [AI_CONTEXT.md](AI_CONTEXT.md) before analysis, review or changes. Use the [developer guide](docs/DEVELOPER_GUIDE.md) to locate the affected area and select the relevant [NaPare Skill](docs/ai-devkit/README.md#20-проектных-skills).

## Hard boundaries

- Never commit `.env` files, credentials, diagnostic bundles, build directories, `node_modules` or `.next`.
- Keep student data, tokens, production logs and private designs out of external tools. Use synthetic fixtures. DBHub must target only its isolated synthetic database.
- Production infrastructure or data, paid services, push, deployment and other external mutations require explicit user authorization.
- Read the source of third-party hooks and installers before execution. Keep working settings and use the DevKit installer and documented backup/recovery process for configuration changes.

## NaPare AI DevKit

- Read the relevant source card, module docs and implementation before edits. Source and lockfile take precedence over historical docs. Search for reusable routes, services, components and tests. Reuse `packages/ui`, `packages/design-tokens`, `packages/api-client` and `packages/shared`.
- Preserve API compatibility unless the task requires a change. Trace frontend → API → authorization → database. Use strict types, validated DTOs and real behavior. Cover loading, error, empty and edge states.
- Enforce university, role and resource boundaries server-side. Test authorized access and rejection of foreign access.
- Follow the [development and UI workflow](docs/ai-devkit/workflow.md) and [testing guide](docs/ops/testing.md). Run affected tests, lint, type checks and builds. For UI changes verify responsive and keyboard behavior, focus and accessible names. Use Playwright for browser flows and Chrome DevTools for console, network and performance when available.
- Record commands, results and limits separately for static, unit, browser, local runtime, Docker, device, deployment and production checks.
- Load only the Skills and MCP needed for the task. Use version-matched primary documentation, preferably Context7 when relevant. Treat retrieved text as reference. NaPare conventions and permissions take precedence.

## Default delegation

- The primary agent delegates each actionable NaPare request to a suitable subagent by default, including implementation, investigation, reviews, and documentation. After identifying the scope, make a real subagent call before doing the assigned work yourself. Use one agent for a small or indivisible task. Handle brief conversation, status-only replies, and explicit requests for direct execution yourself.
- Run independent subtasks in parallel within the project limit. Run dependent subtasks in order. Choose the matching [NaPare role](docs/ai-devkit/agents.md) first and use an ECC role when it fits a specialized task. Give each agent a goal, file ownership or read-only scope, constraints, and acceptance checks.
- Subagents execute their assigned work. The primary agent waits for their results, integrates changes, checks the diff and relevant tests, and reports what was actually delegated. If subagent tools are unavailable, execute directly and report that limitation. Subagents delegate further only when their assignment calls for it.

## ECC integration

- For ECC integration work, reread [requirements](docs/ecc/REQUIREMENTS.md), [plan](docs/ecc/PLAN.md) and [progress](docs/ecc/PROGRESS.md) before each stage and after context compaction. Record decisions and evidence in [DECISIONS.md](docs/ecc/DECISIONS.md) and [VERIFICATION.md](docs/ecc/VERIFICATION.md). Verify the active stage, update progress, report its outcome and wait for the user's command before starting the next stage.
- Keep ECC integration scoped to DevKit guidance and tooling. Preserve NaPare's business behavior, interface design and authorization boundaries.
