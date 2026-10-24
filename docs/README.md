# NaPare project documentation

Project guides, reference material and historical records live under this directory. Keep app, infrastructure and deliverable folders for source files, configuration and output artifacts; link to those files from here. The repository entry files `AGENTS.md`, `AI_CONTEXT.md`, `README.md` and `RTK.md` stay at the root for their standard tooling roles.

## Sections

- [Product analytics](modules/product-analytics.md) — ten defined own-university metrics, default-off daily activity, observed onboarding readiness and privacy lifecycle.

- [Career moderation](modules/career-moderation.md) — versioned manual review, student complaints, scoped decisions and current verification gaps.

- [Company registry verification](integrations/company-registry.md) — company registration, persisted FNS result and owner recheck; public-search limitations and evidence.

- [University career report](modules/career-university-report.md) — own-university aggregates and XLSX; counts of tasks, applications and accepted works, no employment inference.

- [Account data controls](privacy/account-controls.md) — common JSON download/deletion screen, explicit retained archive, matching-session cleanup and browser evidence.

- [Personal JSON export](privacy/personal-data-export.md) — snapshot, scope, exclusions and verification contract; [account deletion](privacy/account-deletion.md) and [approved archive model](privacy/account-rights-model.md) explain cleanup and retained learning records.

- [Next.js security patch, 23 October](security/next-patch-2026-10-23.md) — workspace pin, new advisory snapshot and verification boundaries.

- [Student accessibility audit](ui/student-wcag-audit-2026-10-22.md) — WCAG 2.1 A/AA findings, browser fixture coverage and manual gaps; no conformance claim.
- [Procurement drafts](procurement/README.md) — technical specification, price evidence form, product card and registry gaps; [three pricing models](strategy/monetization.md) with synthetic arithmetic, no approved tariffs.


- [Combined improvement verification](project-log/improvement-integration-2026-10-22.md) — integration branch, local test evidence and remaining requirements; no production changes.

- [AI and repository workflow](ai/README.md) — project map, task reading order, change safety, source cards and documentation rules.
- [API](api/README.md) — API usage and contracts.
- [University schedule import](integrations/schedule-import.md) — CSV/ICS/XLSX/Moodle/SIBIT formats, durable queue and change journal.
- [Notification delivery](integrations/notification-delivery.md) — gated RuStore/WebPush/MAX/Telegram delivery, Redis outbox and operational limits.

- [Architecture](architecture/README.md) — system structure and historical configuration notes.
- [Clients](clients/mobile.md) — Android and web client behavior; other client notes are in this directory.
- [Student offline schedule](clients/student-offline.md) — service worker, сохранение расписания и границы локального кэша.
- [Database](database/schema-overview.md) — schema notes and migrations.
- [Decisions](decisions/) — architecture and deployment decisions.
- [Deployment](deployment/README.md) — production deployment, Nginx, TLS, platform control and app-store procedures.
- [Design](design/) and [UI](ui/) — interface standards and implementation guidance.
- [Legal](legal/) and [Security](security/) — drafts, privacy and security guidance.
- [Personal data assessment](legal/personal-data-assessment.md), [data map](privacy/data-map.md), [RF/on-premise deployment](legal/rf-deployment-assessment.md), [processing agreement](legal/data-processing-agreement-draft.md) and [consent drafts](legal/consent-drafts.md) — dated engineering findings and drafts for operator/legal review; deployment and compliance are not confirmed.
- [Tenant isolation](security/tenant-isolation.md) and [Role matrix](security/role-matrix.md) — SQL boundaries, route inventory and authorization checks.
- [Modules](modules/) and [Product](product/) — feature behavior and product boundaries.
- [Moodle semester overview](integrations/moodle-semester.md) — self API, explicit numeric identities, source attribution and unavailable-data semantics.
- [University onboarding](modules/university-onboarding.md) — owner bootstrap, administrator handoff, schedule import and scoped readiness checklist.

- [Academic office](modules/academic-office.md) — заявления, назначения, согласования и рабочее место диспетчера.

- [T-Касса](integrations/tkassa.md) — оплата услуг платформы, настройка и границы проверки.

- [Operations](ops/) and [Process](process/) — routine operations, verification and collaboration.
- [Planning and history](project-log/) — dated project records; older or superseded material is labeled in [the archive](archive/) and [Superpowers plans](superpowers/).
- [Strategy](strategy/) — goals and product direction.
- [Deliverables](deliverables/) — instructions and compliance notes for project submissions; binary files and generated artifacts remain in their delivery folders.

For a new task, start with [AI_CONTEXT.md](../AI_CONTEXT.md), then follow its reading order.
