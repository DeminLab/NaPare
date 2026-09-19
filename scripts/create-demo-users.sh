#!/usr/bin/env bash

set -euo pipefail

university_id="$(docker compose exec -T postgres sh -c 'psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id FROM universities LIMIT 1"' | tr -d '\r')"

if [[ -z "$university_id" ]]; then
  echo 'Университет в базе не найден.' >&2
  exit 1
fi

hash_password() {
  docker compose exec -T -e PLAIN_PASSWORD="$1" backend \
    node -e "require('bcrypt').hash(process.env.PLAIN_PASSWORD, 12).then(console.log)"
}

student_password="$(openssl rand -hex 12)"
teacher_password="$(openssl rand -hex 12)"
deanery_password="$(openssl rand -hex 12)"
developer_password="$(openssl rand -hex 12)"

student_hash="$(hash_password "$student_password")"
teacher_hash="$(hash_password "$teacher_password")"
deanery_hash="$(hash_password "$deanery_password")"
developer_hash="$(hash_password "$developer_password")"

docker compose exec -T postgres sh -c \
  'psql -v ON_ERROR_STOP=1 \
    -v university_id="$1" \
    -v student_hash="$2" \
    -v teacher_hash="$3" \
    -v deanery_hash="$4" \
    -v developer_hash="$5" \
    -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  sh "$university_id" "$student_hash" "$teacher_hash" "$deanery_hash" "$developer_hash" <<'SQL'
INSERT INTO "users"
  ("email", "passwordHash", "firstName", "lastName", "role", "universityId", "isActive")
VALUES
  ('student@napare.sano.ru', :'student_hash', 'Тест', 'Студент', 'student', :'university_id', true),
  ('teacher@napare.sano.ru', :'teacher_hash', 'Тест', 'Преподаватель', 'teacher', :'university_id', true),
  ('deanery@napare.sano.ru', :'deanery_hash', 'Тест', 'Деканат', 'university_admin', :'university_id', true),
  ('developer@napare.sano.ru', :'developer_hash', 'Тест', 'Разработчик', 'developer', :'university_id', true)
ON CONFLICT ("email") DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  "firstName" = EXCLUDED."firstName",
  "lastName" = EXCLUDED."lastName",
  "role" = EXCLUDED."role",
  "universityId" = EXCLUDED."universityId",
  "isActive" = true;
SQL

echo
echo 'Аккаунты созданы. Сохраните пароли:'
printf 'student@napare.sano.ru    %s\n' "$student_password"
printf 'teacher@napare.sano.ru    %s\n' "$teacher_password"
printf 'deanery@napare.sano.ru    %s\n' "$deanery_password"
printf 'developer@napare.sano.ru  %s\n' "$developer_password"
