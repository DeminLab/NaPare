-- Создание университета
INSERT INTO universities (name, city, status) VALUES ('Test University', 'Moscow', 'active')
RETURNING id;

-- Хеширование пароля (password123)
-- bcrypt hash для password123: $2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

-- Создание пользователей для каждого фронтенда
INSERT INTO users (email, passwordHash, firstName, lastName, role, universityId, isActive, createdAt, updatedAt) VALUES
('portal@example.com', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Portal', 'User', 'student', (SELECT id FROM universities WHERE name = 'Test University'), true, NOW(), NOW()),
('student@example.com', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Student', 'User', 'student', (SELECT id FROM universities WHERE name = 'Test University'), true, NOW(), NOW()),
('staff@example.com', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Staff', 'User', 'teacher', (SELECT id FROM universities WHERE name = 'Test University'), true, NOW(), NOW()),
('admin@example.com', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Admin', 'User', 'university_admin', (SELECT id FROM universities WHERE name = 'Test University'), true, NOW(), NOW()),
('developer@example.com', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Developer', 'User', 'developer', (SELECT id FROM universities WHERE name = 'Test University'), true, NOW(), NOW());

-- Показать созданные аккаунты
SELECT
    'portal@example.com' as email,
    'Portal User' as name,
    'student' as role,
    'password123' as password
UNION ALL
SELECT
    'student@example.com',
    'Student User',
    'student',
    'password123'
UNION ALL
SELECT
    'staff@example.com',
    'Staff User',
    'teacher',
    'password123'
UNION ALL
SELECT
    'admin@example.com',
    'Admin User',
    'university_admin',
    'password123'
UNION ALL
SELECT
    'developer@example.com',
    'Developer User',
    'developer',
    'password123';
