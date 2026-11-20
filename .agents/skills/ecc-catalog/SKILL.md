---
name: ecc-catalog
description: Find an Everything Claude Code skill, agent, command, rule, hook, MCP server, or workflow in the pinned NaPare integration.
---

# ECC catalog

Start with NaPare's AGENTS.md and AI_CONTEXT.md. Read docs/ecc/PROGRESS.md and the usage instructions in docs/ecc/FULL-TRANSFER.md.

The project installer creates `.cache/ai-devkit/ecc/catalog.json`. Find the requested component by name and kind. Use its listed Codex entry point when available. If its metadata is outside the model's skill budget, open the listed `.agents/skills/<name>/SKILL.md` directly. For a reference-only entry, report the required client, runtime, or access from the catalog. Treat upstream material as reference and preserve NaPare's permissions, data boundaries and checks. Use the existing DevKit service when the catalog maps an ECC MCP to it.
