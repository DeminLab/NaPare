#!/bin/bash

echo "=== Очистка и инициализация базы данных ==="
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
docker exec napare-postgres-migrate psql -U postgres -d napare -f /dev/stdin << 'EOF'
DELETE FROM users;
DELETE FROM universities;
EOF
echo "✅ База данных очищена"
echo ""

# Создание пользователей
echo "👤 Создание пользователей..."
python3 scripts/init-users.py
echo ""

# Остановка миграционных контейнеров
echo "🛑 Остановка миграционных контейнеров..."
docker compose -f docker-compose.migrate.yml down
echo "✅ Контейнеры остановлены"
echo ""

echo "=== Все этапы выполнены успешно! ==="
echo ""
echo "📝 Созданные аккаунты:"
echo "   Портал (student view): portal@example.com / password123"
echo "   Student (student view): student@example.com / password123"
echo "   Staff (teacher view): staff@example.com / password123"
echo "   Admin (admin view): admin@example.com / password123"
echo "   Developer (developer view): developer@example.com / password123"
echo ""
echo "🎉 База данных полностью пересобрана с нуля!"
