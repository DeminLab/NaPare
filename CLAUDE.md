# NaPare — Claude Code entry point

Read [AGENTS.md](AGENTS.md) and then [AI_CONTEXT.md](AI_CONTEXT.md). They define the project rules and reading order for every AI contributor.

Use the shared Skills in `.agents/skills/` as on-demand reference instructions. For a task, read the relevant `napare-*/SKILL.md` and only the vendor references it actually needs. This path is the single maintained source; do not copy all Skills into `.claude/` or assume Codex discovers Claude plugins, commands, hooks or agents.

The [DevKit workflow](docs/ai-devkit/workflow.md) and [role contracts](docs/ai-devkit/agents.md) apply. Tool availability depends on the current client and authorization; configuration alone is not evidence of a working connection. No Claude hooks or global settings are installed by this entry point.
