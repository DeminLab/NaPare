# Ownership and CODEOWNERS

The repository does not define named individual owners in a tracked CODEOWNERS file. The table below describes affected areas, not assigned people. Assign reviewers for each change in the GitHub PR.

| Area | Review surface |
| --- | --- |
| Backend/API | Controller, DTO, service authorization, entities/migrations and generated OpenAPI |
| Student | apps/web-student; observe repository protection rules before role-workspace work |
| Staff/admin/developer/portal | Relevant Next.js app, shared packages and backend contracts |
| Deployment | Compose, Dockerfiles, Nginx, CI workflow and docs/deployment/production.md |
| Documentation | The matching implementation or operational source, plus docs navigation/index where needed |
| Legal | Product/operator verification and qualified legal review before publication |

## Change boundaries

See root AGENTS.md and [change safety](../ai/change-safety.md) for protected paths and required checks. Do not rely on the historical team roles or GitHub handles that were present in an earlier version of this file.
