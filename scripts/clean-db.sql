-- Очистка всех данных перед созданием новых
DELETE FROM users;
DELETE FROM universities;

-- Показать результат
SELECT 'База данных очищена' as status;
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as university_count FROM universities;
