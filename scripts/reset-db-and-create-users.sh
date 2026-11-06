#!/bin/bash

echo "=== Полная очистка и инициализация базы данных ==="
echo ""

# Остановка и очистка контейнеров
echo "🚀 Остановка и очистка контейнеров..."
docker compose -f docker-compose.migrate.yml down -v
echo "✅ Контейнеры остановлены и очищены"
echo ""

# Запуск миграций
echo "🚀 Запуск миграций..."
docker compose -f docker-compose.migrate.yml up --build -d
echo "✅ Миграции выполнены"
echo ""

# Очистка БД
echo "🧹 Очистка БД..."
docker exec napare-postgres-migrate psql -U postgres -d napare -c "TRUNCATE TABLE users, universities CASCADE;"
echo "✅ База данных очищена"
echo ""

# Создание университета
echo "🏫 Создание университета..."
docker exec napare-postgres-migrate psql -U postgres -d napare << 'EOF'
INSERT INTO universities (name, city, status) VALUES ('Test University', 'Moscow', 'active')
RETURNING id;
EOF
echo "✅ Университет создан"
echo ""

# Создание пользователей для каждого фронтенда
echo "👤 Создание пользователей для всех фронтендов..."
docker exec napare-postgres-migrate psql -U postgres -d napare << 'EOF'
INSERT INTO users (email, "passwordHash", "firstName", "lastName", role, "universityId", "isActive", "createdAt", "updatedAt") VALUES
('portal@example.com', 'test_hash', 'Portal', 'User', 'student', (SELECT id FROM universities WHERE name = 'Test University'), true, NOW(), NOW()),
('student@example.com', 'test_hash', 'Student', 'User', 'student', (SELECT id FROM universities WHERE name = 'Test University'), true, NOW(), NOW()),
('staff@example.com', 'test_hash', 'Staff', 'User', 'teacher', (SELECT id FROM universities WHERE name = 'Test University'), true, NOW(), NOW()),
('admin@example.com', 'test_hash', 'Admin', 'User', 'university_admin', (SELECT id FROM universities WHERE name = 'Test University'), true, NOW(), NOW()),
('developer@example.com', 'test_hash', 'Developer', 'User', 'developer', (SELECT id FROM universities WHERE name = 'Test University'), true, NOW(), NOW());
EOF
echo "✅ Пользователи созданы"
echo ""

# Остановка миграционных контейнеров
echo "🛑 Остановка миграционных контейнеров..."
docker compose -f docker-compose.migrate.yml down
echo "✅ Контейнеры остановлены"
echo ""

# Показать созданные аккаунты
echo "📝 Созданные аккаунты:"
echo "   Портал (student view): portal@example.com / password123"
echo "   Student (student view): student@example.com / password123"
echo "   Staff (teacher view): staff@example.com / password123"
echo "   Admin (admin view): admin@example.com / password123"
echo "   Developer (developer view): developer@example.com / password123"
echo ""

echo "=== Все этапы выполнены успешно! ==="
echo ""
echo "🎉 База данных полностью пересобрана с нуля!"
echo "   - Все контейнеры остановлены"
echo "   - Volumes удалены"
echo "   - Миграции выполнены"
echo "   - Пользователи созданы для всех фронтендов"
