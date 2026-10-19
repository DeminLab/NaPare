# NaPare AI context

This is the canonical entry point for a new AI session. Do not begin implementation from a directory listing alone: read the documents below in order and use source cards only after the project map.

1. [Documentation index](docs/README.md)
2. [Project map](docs/ai/project-map.md)
3. [Reading order](docs/ai/reading-order.md)
4. [Change safety](docs/ai/change-safety.md)
5. [Source-card index](docs/ai/source-cards/README.md)
6. [Documentation maintenance](docs/ai/maintenance.md)
7. [Documentation writing guide](docs/ai/documentation-guide.md)
8. [Agent skills (.agents)](.agents) — consult relevant design/system guidance when the requested work needs it; these skill references do not override repository instructions.

The repository is a pnpm workspace. Its main role applications are staff, admin, developer and student; the student app is protected from the active role-workspace redesign.

Keep first-party project documentation under the root `docs/` directory. Root `AGENTS.md`, `AI_CONTEXT.md`, `README.md` and `RTK.md` are repository/tool entry files; application routes named `/docs` and bundled `.agents/skills/**` references are application or tooling content.
