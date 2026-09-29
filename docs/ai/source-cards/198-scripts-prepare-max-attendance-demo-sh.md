# Source card: `scripts/prepare-max-attendance-demo.sh`

## Canonical source

`scripts/prepare-max-attendance-demo.sh`

## Scope

Prepare repeatable synthetic student/teacher accounts and a clearly labeled attendance lesson for the MAX hackathon scenario. The script requires an explicit isolated-database marker, a Compose project name and PostgreSQL database name containing `demo` or `test`, and an existing group UUID. It explicitly targets `.env` plus `docker-compose.prod.yml`, assigns the student to that group, gives the synthetic lesson to the demo teacher, and removes only the previous attendance entry for that exact synthetic lesson/student pair. On rerun it resets demo passwords, unlinks MAX/Telegram IDs and invalidates existing demo JWT sessions so the first-link flow can be repeated.

## Read sequence

1. Read [the hackathon demo runbook](../../hackathon-demo.md) and [MAX client flow](../../clients/max-miniapp.md).
2. Read this script before executing it; it writes users, a lesson, QR revocations and a demo attendance row to the explicit Docker Compose project/database.
3. Create an isolated project/database and check its name before setting `MAX_DEMO_TARGET=isolated` and `COMPOSE_PROJECT_NAME`.

## Change boundary

Never run this against production or a database with real users. Keep both explicit target checks, require a UUID belonging to an existing group, keep the lesson marked as synthetic, and do not capture the generated passwords in shared logs. Do not broaden the account reset or attendance cleanup beyond the two named demo accounts and the marked demo lesson/student.

## Verification

```bash
bash -n scripts/prepare-max-attendance-demo.sh
```

The syntax check does not execute SQL or prove the selected database is isolated. Validate the prepared records in the dedicated demo environment before the MAX device walkthrough.
