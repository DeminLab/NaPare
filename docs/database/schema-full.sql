# Полная SQL-схема (PostgreSQL 16)

Source of truth для структуры БД. Генерируется из Prisma/TypeORM миграций, но этот файл — эталон.

---

## Расширения

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

---

## 1. universities

```sql
CREATE TABLE universities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'RU',
    connector_config JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_universities_name ON universities USING gin(name gin_trgm_ops);
CREATE INDEX idx_universities_city ON universities(city);
CREATE INDEX idx_universities_status ON universities(status);
```

---

## 2. faculties

```sql
CREATE TABLE faculties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(20),
    dean_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_faculties_university ON faculties(university_id);
```

---

## 3. groups

```sql
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    faculty_id UUID NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    curriculum_year INT NOT NULL CHECK (curriculum_year BETWEEN 1 AND 6),
    specialization VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_groups_faculty_name ON groups(faculty_id, name);
CREATE INDEX idx_groups_faculty ON groups(faculty_id);
```

---

## 4. users

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    roles VARCHAR NOT NULL DEFAULT 'student',
    university_id UUID REFERENCES universities(id) ON DELETE SET NULL,
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    needs_onboarding BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,

    CONSTRAINT chk_users_contact CHECK (
        phone IS NOT NULL OR email IS NOT NULL
    ),
    CONSTRAINT chk_users_roles CHECK (
        roles <@ ARRAY[
            'student', 'teacher', 'curator',
            'faculty_dean', 'department_head',
            'university_admin', 'superadmin', 'developer'
        ]::text[]
    )
);

CREATE INDEX idx_users_university ON users(university_id);
CREATE INDEX idx_users_group ON users(group_id);
CREATE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_roles ON users USING gin(roles);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_deleted = FALSE;
```

---

## 5. teachers

```sql
CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    department VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_teachers_user_university ON teachers(user_id, university_id);
CREATE INDEX idx_teachers_university ON teachers(university_id);
```

---

## 6. lessons

```sql
CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    subject VARCHAR(255) NOT NULL,
    room VARCHAR(20),
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    week_type VARCHAR(20) DEFAULT 'both'
        CHECK (week_type IN ('odd', 'even', 'both')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    external_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_lessons_time CHECK (end_time > start_time),
    CONSTRAINT chk_lessons_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_lessons_university ON lessons(university_id);
CREATE INDEX idx_lessons_group ON lessons(group_id);
CREATE INDEX idx_lessons_teacher ON lessons(teacher_id);
CREATE INDEX idx_lessons_day_time ON lessons(day_of_week, start_time);
CREATE INDEX idx_lessons_date_range ON lessons(start_date, end_date);
CREATE INDEX idx_lessons_subject ON lessons USING gin(subject gin_trgm_ops);
CREATE INDEX idx_lessons_external ON lessons(external_id) WHERE external_id IS NOT NULL;
```

---

## 7. lesson_changes

```sql
CREATE TABLE lesson_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    change_type VARCHAR(20) NOT NULL
        CHECK (change_type IN ('moved', 'cancelled', 'room_changed', 'teacher_changed', 'added')),
    old_values JSONB,
    new_values JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_changes_lesson ON lesson_changes(lesson_id);
CREATE INDEX idx_changes_type ON lesson_changes(change_type);
CREATE INDEX idx_changes_created ON lesson_changes(created_at);
```

---

## 8. pair_spaces

```sql
CREATE TABLE pair_spaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    active_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_pair_spaces_lesson ON pair_spaces(lesson_id);
CREATE INDEX idx_pair_spaces_active ON pair_spaces(active_until);
```

---

## 9. announcements

```sql
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pair_space_id UUID NOT NULL REFERENCES pair_spaces(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL CHECK (length(text) > 0),
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_announcements_pair_space ON announcements(pair_space_id);
CREATE INDEX idx_announcements_author ON announcements(author_id);
CREATE INDEX idx_announcements_created ON announcements(created_at);
```

---

## 10. homeworks

```sql
CREATE TABLE homeworks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pair_space_id UUID NOT NULL REFERENCES pair_spaces(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL CHECK (length(title) > 0),
    description TEXT,
    deadline TIMESTAMPTZ,
    max_score INT DEFAULT 100 CHECK (max_score > 0),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_rule VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_homeworks_pair_space ON homeworks(pair_space_id);
CREATE INDEX idx_homeworks_deadline ON homeworks(deadline);
CREATE INDEX idx_homeworks_created_by ON homeworks(created_by);
```

---

## 11. homework_submissions

```sql
CREATE TABLE homework_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    homework_id UUID NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'not_submitted'
        CHECK (status IN ('not_submitted', 'submitted')),
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uniq_homework_student UNIQUE (homework_id, student_id)
);

CREATE INDEX idx_submissions_homework ON homework_submissions(homework_id);
CREATE INDEX idx_submissions_student ON homework_submissions(student_id);
```

---

## 12. file_attachments

```sql
CREATE TABLE file_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pair_space_id UUID NOT NULL REFERENCES pair_spaces(id) ON DELETE CASCADE,
    homework_id UUID REFERENCES homeworks(id) ON DELETE SET NULL,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INT NOT NULL CHECK (file_size > 0 AND file_size <= 52428800),
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_files_pair_space ON file_attachments(pair_space_id);
CREATE INDEX idx_files_homework ON file_attachments(homework_id) WHERE homework_id IS NOT NULL;
CREATE INDEX idx_files_uploaded_by ON file_attachments(uploaded_by);
```

---

## 13. discussion_messages

```sql
CREATE TABLE discussion_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pair_space_id UUID NOT NULL REFERENCES pair_spaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL CHECK (length(text) > 0),
    parent_id UUID REFERENCES discussion_messages(id) ON DELETE CASCADE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_pair_space ON discussion_messages(pair_space_id);
CREATE INDEX idx_messages_user ON discussion_messages(user_id);
CREATE INDEX idx_messages_parent ON discussion_messages(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_messages_created ON discussion_messages(created_at);
```

---

## 14. absence_statuses

```sql
CREATE TABLE absence_statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL
        CHECK (type IN ('learning', 'sick', 'work', 'other_city', 'other')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    comment TEXT,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_absence_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_absence_period CHECK (end_date - start_date <= INTERVAL '30 days')
);

CREATE INDEX idx_absence_user ON absence_statuses(user_id);
CREATE INDEX idx_absence_dates ON absence_statuses(start_date, end_date);
CREATE INDEX idx_absence_type ON absence_statuses(type);
```

---

## 15. absence_confirmations

```sql
CREATE TABLE absence_confirmations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    absence_id UUID NOT NULL REFERENCES absence_statuses(id) ON DELETE CASCADE,
    curator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_confirmations_absence ON absence_confirmations(absence_id);
CREATE INDEX idx_confirmations_curator ON absence_confirmations(curator_id);
CREATE INDEX idx_confirmations_status ON absence_confirmations(status);
```

---

## 16. notifications

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    deep_link VARCHAR(500),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created ON notifications(created_at);
CREATE INDEX idx_notifications_type ON notifications(type);
```

---

## 17. device_tokens

```sql
CREATE TABLE device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    token TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_device_token_unique ON device_tokens(user_id, platform, token);
CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX idx_device_tokens_active ON device_tokens(is_active) WHERE is_active = TRUE;
```

---

## 18. audit_logs

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
```

---

## 19. preferences

```sql
CREATE TABLE preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) NOT NULL DEFAULT 'system'
        CHECK (theme IN ('light', 'dark', 'system')),
    language VARCHAR(10) NOT NULL DEFAULT 'ru',
    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    notification_settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Триггеры

### auto-update updated_at

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_universities_updated BEFORE UPDATE ON universities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_faculties_updated BEFORE UPDATE ON faculties FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_groups_updated BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_lessons_updated BEFORE UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_pair_spaces_updated BEFORE UPDATE ON pair_spaces FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_announcements_updated BEFORE UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_homeworks_updated BEFORE UPDATE ON homeworks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_homework_submissions_updated BEFORE UPDATE ON homework_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_discussion_messages_updated BEFORE UPDATE ON discussion_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_absence_statuses_updated BEFORE UPDATE ON absence_statuses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_absence_confirmations_updated BEFORE UPDATE ON absence_confirmations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_device_tokens_updated BEFORE UPDATE ON device_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_preferences_updated BEFORE UPDATE ON preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## Row Level Security (RLS)

```sql
-- Включаем RLS для доменных таблиц
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE pair_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE absence_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: пользователь видит только данные своего вуза
CREATE POLICY university_isolation ON users
    USING (university_id = current_setting('app.university_id')::uuid);

CREATE POLICY university_isolation ON lessons
    USING (university_id = current_setting('app.university_id')::uuid);

-- Policy: студент видит только свою группу
CREATE POLICY student_group_isolation ON lessons
    USING (
        group_id = current_setting('app.group_id')::uuid
        OR current_setting('app.role') IN ('university_admin', 'superadmin', 'faculty_dean', 'department_head')
    );

-- Policy: свои уведомления
CREATE POLICY own_notifications ON notifications
    USING (user_id = current_setting('app.user_id')::uuid);
```

---

## Функции

### Определение текущей недели

```sql
CREATE OR REPLACE FUNCTION get_current_week_type(
    p_semester_start DATE,
    p_date DATE DEFAULT CURRENT_DATE
) RETURNS VARCHAR(20) AS $$
DECLARE
    weeks_passed INT;
BEGIN
    weeks_passed := EXTRACT(WEEK FROM p_date) - EXTRACT(WEEK FROM p_semester_start);
    IF weeks_passed % 2 = 0 THEN
        RETURN 'even';
    ELSE
        RETURN 'odd';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### Автосоздание PairSpace при новой паре

```sql
CREATE OR REPLACE FUNCTION create_pair_space_on_lesson()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO pair_spaces (lesson_id, active_until)
    VALUES (NEW.id, NEW.end_date + INTERVAL '45 days');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lesson_create_pair_space
    AFTER INSERT ON lessons
    FOR EACH ROW
    EXECUTE FUNCTION create_pair_space_on_lesson();
```
