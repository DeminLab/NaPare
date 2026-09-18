-- NaPare Database Initialization Script
-- This script runs automatically when PostgreSQL container starts for the first time.
-- It creates the schema that TypeORM expects based on entity definitions.

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- 1. Create ENUM types
-- ============================================================

-- users.role enum
DO $$ BEGIN
    CREATE TYPE users_role_enum AS ENUM (
        'student', 'teacher', 'curator', 'faculty_dean',
        'department_head', 'university_admin', 'superadmin', 'developer'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- absences.status enum
DO $$ BEGIN
    CREATE TYPE absences_status_enum AS ENUM (
        'absent', 'late', 'excused', 'pending'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- notifications.type enum
DO $$ BEGIN
    CREATE TYPE notifications_type_enum AS ENUM (
        'info', 'warning', 'success', 'error'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- device_tokens.platform enum
DO $$ BEGIN
    CREATE TYPE device_tokens_platform_enum AS ENUM (
        'ios', 'android', 'web'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Create tables
-- ============================================================

-- universities
CREATE TABLE IF NOT EXISTS universities (
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

CREATE INDEX IF NOT EXISTS idx_universities_name ON universities USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_universities_city ON universities(city);
CREATE INDEX IF NOT EXISTS idx_universities_status ON universities(status);

-- users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    avatar_url TEXT,
    role users_role_enum NOT NULL DEFAULT 'student',
    university_id UUID REFERENCES universities(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_university ON users(university_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = TRUE;

-- lessons
CREATE TABLE IF NOT EXISTS lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL,
    date DATE NOT NULL,
    pair_number INTEGER NOT NULL,
    start_time VARCHAR(20) NOT NULL,
    end_time VARCHAR(20) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    subject_type VARCHAR(50),
    teacher_name VARCHAR(255),
    teacher_id VARCHAR(100),
    room VARCHAR(20),
    building VARCHAR(100),
    "group" VARCHAR(100),
    subgroup VARCHAR(100),
    department VARCHAR(255),
    faculty VARCHAR(255),
    notes TEXT,
    is_changed BOOLEAN NOT NULL DEFAULT FALSE,
    change_description TEXT,
    source VARCHAR(100),
    external_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lessons_university_date ON lessons(university_id, date);
CREATE INDEX IF NOT EXISTS idx_lessons_university_teacher_date ON lessons(university_id, teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_lessons_university_group_date ON lessons(university_id, "group", date);
CREATE INDEX IF NOT EXISTS idx_lessons_external ON lessons(external_id) WHERE external_id IS NOT NULL;

-- lesson_changes
CREATE TABLE IF NOT EXISTS lesson_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    old_value JSONB NOT NULL,
    new_value JSONB NOT NULL,
    change_type VARCHAR(50) NOT NULL,
    reason TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by VARCHAR(100),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_changes_lesson ON lesson_changes(lesson_id);

-- pair_spaces
CREATE TABLE IF NOT EXISTS pair_spaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL,
    lesson_id UUID NOT NULL,
    subject VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    pair_number INTEGER NOT NULL,
    teacher_name VARCHAR(255),
    "group" VARCHAR(100),
    room VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pair_spaces_lesson ON pair_spaces(lesson_id);
CREATE INDEX IF NOT EXISTS idx_pair_spaces_university ON pair_spaces(university_id, date);

-- announcements
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pair_space_id UUID NOT NULL REFERENCES pair_spaces(id) ON DELETE CASCADE,
    author_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_pair_space ON announcements(pair_space_id);

-- homeworks
CREATE TABLE IF NOT EXISTS homeworks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pair_space_id UUID NOT NULL REFERENCES pair_spaces(id) ON DELETE CASCADE,
    author_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    deadline TIMESTAMPTZ,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homeworks_pair_space ON homeworks(pair_space_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_deadline ON homeworks(deadline);

-- absences
CREATE TABLE IF NOT EXISTS absences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL,
    student_id UUID NOT NULL,
    lesson_id UUID,
    date DATE NOT NULL,
    pair_number INTEGER NOT NULL,
    subject VARCHAR(255) NOT NULL,
    status absences_status_enum NOT NULL DEFAULT 'pending',
    reason TEXT,
    confirmed_by VARCHAR(100),
    confirmed_at TIMESTAMPTZ,
    is_excused BOOLEAN NOT NULL DEFAULT FALSE,
    excused_by VARCHAR(100),
    excused_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_absences_student ON absences(student_id);
CREATE INDEX IF NOT EXISTS idx_absences_university_date ON absences(university_id, date);
CREATE INDEX IF NOT EXISTS idx_absences_lesson ON absences(lesson_id) WHERE lesson_id IS NOT NULL;

-- notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    university_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    type notifications_type_enum NOT NULL DEFAULT 'info',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    link VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- device_tokens
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    token TEXT NOT NULL,
    platform device_tokens_platform_enum NOT NULL,
    device_name VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(is_active) WHERE is_active = TRUE;

-- ============================================================
-- 3. Seed initial data (optional)
-- ============================================================

-- Register the pilot tenant required by public student registration.
INSERT INTO universities (id, name, city, status)
SELECT uuid_generate_v4(), 'СИБИТ', 'Омск', 'active'
WHERE NOT EXISTS (
    SELECT 1 FROM universities WHERE name = 'СИБИТ' AND city = 'Омск'
);
