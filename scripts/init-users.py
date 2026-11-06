#!/usr/bin/env python3
import asyncio
import bcrypt
import asyncpg
from datetime import datetime

async def main():
    # Подключение к базе данных
    conn = await asyncpg.connect(
        host='localhost',
        port=5432,
        user='postgres',
        password='postgres',
        database='napare'
    )

    print('🧹 Очистка существующих данных...')

    # Удаляем всех пользователей
    await conn.execute('DELETE FROM users')
    print('✅ Пользователи удалены')

    # Удаляем все университеты
    await conn.execute('DELETE FROM universities')
    print('✅ Университеты удалены')

    print('✅ База данных очищена')

    # Создаем университет
    print('\n🏫 Создание университета...')
    university = await conn.fetchrow(
        'INSERT INTO universities (name, city, status) VALUES ($1, $2, $3) RETURNING id, name',
        'Test University',
        'Moscow',
        'active'
    )
    print(f'✅ Университет создан: {university["name"]} (ID: {university["id"]})')

    university_id = university['id']

    # Пароль и его хеш
    password = 'password123'
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    # Пользователи для каждого фронтенда
    users_data = [
        {
            'email': 'portal@example.com',
            'first_name': 'Portal',
            'last_name': 'User',
            'role': 'student',
            'description': 'Web Portal (student view)',
        },
        {
            'email': 'student@example.com',
            'first_name': 'Student',
            'last_name': 'User',
            'role': 'student',
            'description': 'Web Student (student view)',
        },
        {
            'email': 'staff@example.com',
            'first_name': 'Staff',
            'last_name': 'User',
            'role': 'teacher',
            'description': 'Web Staff (teacher view)',
        },
        {
            'email': 'admin@example.com',
            'first_name': 'Admin',
            'last_name': 'User',
            'role': 'university_admin',
            'description': 'Web Admin (admin view)',
        },
        {
            'email': 'developer@example.com',
            'first_name': 'Developer',
            'last_name': 'User',
            'role': 'developer',
            'description': 'Web Developer (developer view)',
        },
    ]

    print('\n👤 Создание пользователей для всех фронтендов:\n')

    for user_data in users_data:
        await conn.execute(
            '''
            INSERT INTO users (
                email, password_hash, first_name, last_name, role,
                university_id, is_active, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ''',
            user_data['email'],
            password_hash,
            user_data['first_name'],
            user_data['last_name'],
            user_data['role'],
            university_id,
            True
        )

        print(f'✅ {user_data["description"]}')
        print(f'   Email: {user_data["email"]}')
        print(f'   Password: {password}')
        print(f'   Role: {user_data["role"]}')
        print('')

    # Показать статистику
    user_count = await conn.fetchval('SELECT COUNT(*) FROM users')
    university_count = await conn.fetchval('SELECT COUNT(*) FROM universities')

    print(f'\n✅ Статистика:')
    print(f'   Пользователей: {user_count}')
    print(f'   Университетов: {university_count}')

    # Показать созданные аккаунты
    print('\n📝 Информация для входа:')
    for user_data in users_data:
        print(f'   {user_data["description"]}: {user_data["email"]} / {password}')

    await conn.close()
    print('\n🎉 Все аккаунты созданы успешно!')

if __name__ == '__main__':
    asyncio.run(main())
