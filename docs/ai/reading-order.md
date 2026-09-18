# Reading order for new tasks

| Task type | Read before acting | Verify after acting |
| --- | --- | --- |
| API or authorization | API docs, backend source card, affected client card | focused backend test or typecheck |
| Role UI | role globals, local UI primitives, target page card | role typecheck and lint |
| Student UI | user approval plus student route card | focused student check |
| Docker/runtime | Compose files and infrastructure cards | `docker compose config` when Docker is available |
| Broad project review | this map, architecture docs, API README, source-card index | documentation validator |

For an unfamiliar file, read its card first, then its direct imports and only then wider dependencies.
