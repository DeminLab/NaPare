# Runbooks

## 1. Парсер расписания СИБИТ упал

**Симптом:** Алерт "Schedule sync failed", last_success > 24ч.

**Действия:**
1. Проверить логи: `docker compose logs backend | grep connector`
2. Проверить доступность сайта СИБИТ: `curl https://sibit.ru/schedule`
3. Если сайт изменился — обновить парсер в `apps/backend/src/schedule/connectors/sibit-connector.ts`
4. Запустить ручной синк: `POST /api/v1/admin/schedule/sync`
5. Если не помогает — временно переключить на ручной импорт

---

## 2. SMS не уходит

**Симптом:** Студент не получает SMS-код.

**Действия:**
1. Проверить баланс SMS-провайдера
2. Проверить логи: `docker compose logs backend | grep sms`
3. Проверить rate limiting: не превышен ли лимит
4. Проверить номер телефона (формат +7XXXXXXXXXX)
5. Если провайдер упал — временно переключить на email-код

---

## 3. Push не доставляется

**Симптом:** Студент не получает push-уведомления.

**Действия:**
1. Проверить Firebase/APNs консоль (статус доставки)
2. Проверить device_token в БД: `SELECT * FROM device_tokens WHERE user_id = '...'`
3. Проверить логи Notification Service
4. ПроверитьFCM/APNs credentials
5. Проверить Deep link в уведомлении

---

## 4. БД: мало места

**Симптом:** Алерт "Disk space > 85%".

**Действия:**
1. Проверить размер: `docker exec postgres psql -c "SELECT pg_database_size('napare')"`
2. Очистить audit_logs старше 1 года: `DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '1 year'`
3. Очистить notifications старше 60 дней
4. Очистить старые бэкапы
5. Расширить диск если нужно

---

## 5. Redis: память заканчивается

**Симптом:** Алерт "Redis memory > 80%".

**Действия:**
1. Проверить размер: `redis-cli INFO memory`
2. Очистить устаревшие ключи: `redis-cli --scan --pattern "session:*" | xargs -L 1 redis-cli DEL`
3. Проверить rate limiting keys
4. При необходимости — увеличить maxmemory

---

## 6. Backend не отвечает

**Симптом:** API возвращает 502/503.

**Действия:**
1. Проверить контейнер: `docker ps | grep backend`
2. Проверить логи: `docker compose logs backend --tail 100`
3. Проверить health check: `curl http://localhost:3000/api/v1/health`
4. Перезапустить: `docker compose restart backend`
5. Если не помогает — проверить БД и Redis

---

## Общая информация

| Сервис | Порт | Health check |
|--------|------|--------------|
| Backend | 3000 | `GET /api/v1/health` |
| Web | 3001 | `GET /` |
| PostgreSQL | 5432 | `pg_isready` |
| Redis | 6379 | `redis-cli ping` |
| MinIO | 9000 | `GET /minio/health/live` |
