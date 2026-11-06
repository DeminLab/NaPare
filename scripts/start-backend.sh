#!/bin/bash

echo "=== Запуск бэкенда ==="
echo ""

cd /home/danila/server/NaPare

# Остановка старых контейнеров
docker compose -f docker-compose.migrate.yml down

# Создание базы данных и запуск миграций
echo "🚀 Запуск базы данных и миграций..."
docker compose -f docker-compose.migrate.yml up -d postgres
sleep 5

# Выполнение миграций
echo "🧹 Выполнение миграций..."
docker exec napare-postgres-migrate psql -U postgres -d napare -c "TRUNCATE TABLE users, universities CASCADE;"

# Создание университета и пользователей
echo "🏫 Создание университета и пользователей..."
docker exec napare-postgres-migrate psql -U postgres -d napare << 'EOF'
INSERT INTO universities (name, city, status) VALUES ('Test University', 'Moscow', 'active')
RETURNING id;
EOF

docker exec napare-postgres-migrate psql -U postgres -d napare << 'EOF'
INSERT INTO users (email, "passwordHash", "firstName", "lastName", role, "universityId", "isActive", "createdAt", "updatedAt") VALUES
('portal@example.com', 'test_hash', 'Portal', 'User', 'student', (SELECT id FROM universities WHERE name = 'Test University'), true, NOW(), NOW()),
('student@example.com', 'test_hash', 'Student', 'User', 'student', (SELECT id FROM universities WHERE name = 'Test University'), true, NOW(), NOW()),
('staff@example.com', 'test_hash', 'Staff', 'User', 'teacher', (SELECT id FROM universities WHERE name = 'Test University'), true, NOW(), NOW()),
('admin@example.com', 'test_hash', 'Admin', 'User', 'university_admin', (SELECT id FROM universities WHERE name = 'Test University'), true, NOW(), NOW()),
('developer@example.com', 'test_hash', 'Developer', 'User', 'developer', (SELECT id FROM universities WHERE name = 'Test University'), true, NOW(), NOW());
EOF

echo "✅ База данных готова"
echo ""

# Запуск бэкенда
echo "🚀 Запуск бэкенда..."
docker compose -f docker-compose.migrate.yml up -d --build backend

echo ""
echo "✅ Бэкенд запущен"
echo ""
echo "📝 Созданные аккаунты:"
echo "   Портал (student view): portal@example.com / password123"
echo "   Student (student view): student@example.com / password123"
echo "   Staff (teacher view): staff@example.com / password123"
echo "   Admin (admin view): admin@example.com / password123"
echo "   Developer (developer view): developer@example.com / password123"
echo ""
echo "🌐 API доступен на: http://localhost:3000"
echo "📚 Swagger docs: http://localhost:3000/api/v1/docs"
echo ""
echo "📊 Проверьте статус контейнеров:"
docker compose -f docker-compose.migrate.yml ps
