#!/usr/bin/env bash

set -euo pipefail

if [[ "${MAX_DEMO_TARGET:-}" != "isolated" ]]; then
  echo 'Refusing to write demo data. Set MAX_DEMO_TARGET=isolated only for a dedicated demo database.' >&2
  exit 1
fi

compose_project="${COMPOSE_PROJECT_NAME:-}"
if [[ ! "$compose_project" =~ (demo|test) ]]; then
  echo 'Set COMPOSE_PROJECT_NAME to a dedicated project name containing "demo" or "test".' >&2
  exit 1
fi

compose=(docker compose --env-file .env -f docker-compose.prod.yml -p "$compose_project")

group_id="${MAX_DEMO_GROUP_ID:-}"
if [[ ! "$group_id" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
  echo 'Set MAX_DEMO_GROUP_ID to the UUID of an existing demo group.' >&2
  exit 1
fi

database_name="$("${compose[@]}" exec -T postgres sh -c 'printf "%s" "$POSTGRES_DB"' | tr -d '\r')"
if [[ "$database_name" != *demo* && "$database_name" != *test* ]]; then
  echo 'Refusing to write demo data: selected POSTGRES_DB name must contain "demo" or "test".' >&2
  exit 1
fi

group_row="$("${compose[@]}" exec -T postgres sh -c \
  'psql -v ON_ERROR_STOP=1 -At -F "|" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, \"universityId\", \"name\" FROM \"groups\""' \
  | awk -F '|' -v wanted="$group_id" 'tolower($1) == tolower(wanted) { print $2 "|" $3 }' | tr -d '\r')"
if [[ -z "$group_row" ]]; then
  echo 'The requested group does not exist in the selected database.' >&2
  exit 1
fi
university_id="${group_row%%|*}"
group_name="${group_row#*|}"

hash_password() {
  "${compose[@]}" exec -T -e PLAIN_PASSWORD="$1" backend \
    node -e "require('bcrypt').hash(process.env.PLAIN_PASSWORD, 12).then(console.log)"
}

student_password="$(openssl rand -hex 12)"
teacher_password="$(openssl rand -hex 12)"
student_hash="$(hash_password "$student_password")"
teacher_hash="$(hash_password "$teacher_password")"

"${compose[@]}" exec -T postgres sh -c \
  'psql -v ON_ERROR_STOP=1 \
    -v university_id="$1" \
    -v group_id="$2" \
    -v student_hash="$3" \
    -v teacher_hash="$4" \
    -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  sh "$university_id" "$group_id" "$student_hash" "$teacher_hash" <<'SQL'
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('napare:max-attendance-demo'));

INSERT INTO "users"
  ("email", "passwordHash", "firstName", "lastName", "role", "universityId", "groupId", "isActive")
VALUES
  ('max-student@demo.napare', :'student_hash', 'Тест', 'Студент MAX', 'student', :'university_id', :'group_id', true),
  ('max-teacher@demo.napare', :'teacher_hash', 'Тест', 'Преподаватель MAX', 'teacher', :'university_id', NULL, true)
ON CONFLICT ("email") DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  "firstName" = EXCLUDED."firstName",
  "lastName" = EXCLUDED."lastName",
  "role" = EXCLUDED."role",
  "universityId" = EXCLUDED."universityId",
  "groupId" = EXCLUDED."groupId",
  "isActive" = true,
  "maxUserId" = NULL,
  "telegramUserId" = NULL,
  "sessionVersion" = "users"."sessionVersion" + 1,
  "lastLoginAt" = NULL;

UPDATE "lessons" AS lesson
SET "universityId" = :'university_id'::uuid,
    "groupId" = :'group_id'::uuid,
    "teacherId" = teacher.id,
    subject = 'ТЕСТ: отметка посещаемости MAX',
    "subjectType" = 'practice',
    "dayOfWeek" = EXTRACT(DOW FROM CURRENT_TIMESTAMP)::integer,
    "startTime" = to_char(CURRENT_TIMESTAMP - INTERVAL '5 minutes', 'HH24:MI'),
    "endTime" = to_char(CURRENT_TIMESTAMP + INTERVAL '40 minutes', 'HH24:MI'),
    "pairNumber" = 1,
    "weekType" = 'both',
    "startDate" = CURRENT_TIMESTAMP - INTERVAL '5 minutes',
    "endDate" = CURRENT_TIMESTAMP + INTERVAL '40 minutes',
    "teacherName" = 'Тест Преподаватель MAX',
    "groupName" = demo_group.name,
    source = 'hackathon-demo',
    "externalId" = 'max-attendance-demo',
    "syncStatus" = 'synthetic'
FROM "groups" AS demo_group
CROSS JOIN "users" AS teacher
WHERE lesson.source = 'hackathon-demo'
  AND lesson."externalId" = 'max-attendance-demo'
  AND demo_group.id = :'group_id'::uuid
  AND teacher.email = 'max-teacher@demo.napare';

INSERT INTO "lessons"
  ("universityId", "groupId", "teacherId", subject, "subjectType", "dayOfWeek", "startTime", "endTime",
   "pairNumber", "weekType", "startDate", "endDate", "teacherName", "groupName", source, "externalId", "syncStatus")
SELECT :'university_id'::uuid,
       :'group_id'::uuid,
       teacher.id,
       'ТЕСТ: отметка посещаемости MAX',
       'practice',
       EXTRACT(DOW FROM CURRENT_TIMESTAMP)::integer,
       to_char(CURRENT_TIMESTAMP - INTERVAL '5 minutes', 'HH24:MI'),
       to_char(CURRENT_TIMESTAMP + INTERVAL '40 minutes', 'HH24:MI'),
       1,
       'both',
       CURRENT_TIMESTAMP - INTERVAL '5 minutes',
       CURRENT_TIMESTAMP + INTERVAL '40 minutes',
       'Тест Преподаватель MAX',
       demo_group.name,
       'hackathon-demo',
       'max-attendance-demo',
       'synthetic'
FROM "groups" AS demo_group
CROSS JOIN "users" AS teacher
WHERE demo_group.id = :'group_id'::uuid
  AND teacher.email = 'max-teacher@demo.napare'
  AND NOT EXISTS (
    SELECT 1 FROM "lessons" AS existing
    WHERE existing."universityId" = :'university_id'::uuid
      AND existing."groupId" = :'group_id'::uuid
      AND existing.source = 'hackathon-demo'
      AND existing."externalId" = 'max-attendance-demo'
  );

UPDATE "attendance_qr_sessions" AS qr
SET "revokedAt" = CURRENT_TIMESTAMP
FROM "lessons" AS lesson
WHERE qr."lessonId" = lesson.id
  AND lesson."universityId" = :'university_id'::uuid
  AND lesson."groupId" = :'group_id'::uuid
  AND lesson.source = 'hackathon-demo'
  AND lesson."externalId" = 'max-attendance-demo'
  AND qr."revokedAt" IS NULL;

DELETE FROM "attendance_records" AS attendance
USING "lessons" AS lesson, "users" AS student
WHERE attendance."lessonId" = lesson.id
  AND attendance."studentId" = student.id
  AND lesson."universityId" = :'university_id'::uuid
  AND lesson."groupId" = :'group_id'::uuid
  AND lesson.source = 'hackathon-demo'
  AND lesson."externalId" = 'max-attendance-demo'
  AND student.email = 'max-student@demo.napare';

COMMIT;

SELECT 'Synthetic MAX attendance lesson is ready for group ' || :'group_id';
SQL

echo
echo 'MAX attendance demo accounts (deliver passwords only through a secure channel):'
printf 'max-student@demo.napare  %s\n' "$student_password"
printf 'max-teacher@demo.napare  %s\n' "$teacher_password"
printf 'Group: %s (%s)\n' "$group_name" "$group_id"
echo 'The lesson is marked source=hackathon-demo and is active for QR check-in now.'
