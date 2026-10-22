# NaPare project documentation

Project guides, reference material and historical records live under this directory. Keep app, infrastructure and deliverable folders for source files, configuration and output artifacts; link to those files from here. The repository entry files `AGENTS.md`, `AI_CONTEXT.md`, `README.md` and `RTK.md` stay at the root for their standard tooling roles.

## Sections

- [AI and repository workflow](ai/README.md) — project map, task reading order, change safety, source cards and documentation rules.
- [API](api/README.md) — API usage and contracts.
- [Architecture](architecture/README.md) — system structure and historical configuration notes.
- [Clients](clients/mobile.md) — Android and web client behavior; other client notes are in this directory.
- [Database](database/schema-overview.md) — schema notes and migrations.
- [Decisions](decisions/) — architecture and deployment decisions.
- [Deployment](deployment/README.md) — production deployment, Nginx, TLS, platform control and app-store procedures.
- [Design](design/) and [UI](ui/) — interface standards and implementation guidance.
- [Legal](legal/) and [Security](security/) — drafts, privacy and security guidance.
- [Personal data assessment](legal/personal-data-assessment.md), [data map](privacy/data-map.md), [RF/on-premise deployment](legal/rf-deployment-assessment.md), [processing agreement](legal/data-processing-agreement-draft.md) and [consent drafts](legal/consent-drafts.md) — dated engineering findings and drafts for operator/legal review; deployment and compliance are not confirmed.
- [Tenant isolation](security/tenant-isolation.md) and [Role matrix](security/role-matrix.md) — SQL boundaries, route inventory and authorization checks.
- [Modules](modules/) and [Product](product/) — feature behavior and product boundaries.
- [Operations](ops/) and [Process](process/) — routine operations, verification and collaboration.
- [Planning and history](project-log/) — dated project records; older or superseded material is labeled in [the archive](archive/) and [Superpowers plans](superpowers/).
- [Strategy](strategy/) — goals and product direction.
- [Deliverables](deliverables/) — instructions and compliance notes for project submissions; binary files and generated artifacts remain in their delivery folders.

For a new task, start with [AI_CONTEXT.md](../AI_CONTEXT.md), then follow its reading order.
