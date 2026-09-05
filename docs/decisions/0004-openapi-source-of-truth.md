# ADR-0004: OpenAPI как Source of Truth

## Статус
Принято

## Контекст
Нужен единый источник правды для API-контрактов между backend и клиентами (Mobile, Web, MAX). Ручное ведение документации приводит к рассинхронизации.

## Решение
**OpenAPI-спецификация генерируется из кода** NestJS (декораторы Swagger) и является единственным источником правды.

### Принципы
1. **Не рисовать OpenAPI вручную** — только через декораторы
2. **Автоматическая генерация** при сборке
3. **Единый формат ошибок** для всех эндпоинтов
4. **Пагинация** по единому стандарту

### Реализация в NestJS
```typescript
@ApiTags('Schedule')
@Controller('api/v1/schedule')
export class ScheduleController {
  @Get('my')
  @ApiOperation({ summary: 'Получить персональное расписание' })
  @ApiResponse({ status: 200, type: ScheduleResponseDto })
  @ApiResponse({ status: 401, type: ErrorResponseDto })
  async getMySchedule(@CurrentUser() user: JwtPayload) {
    return this.scheduleService.getMySchedule(user);
  }
}
```

### Генерация клиента
```bash
# TypeScript клиент из OpenAPI
npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:3000/api/docs-json \
  -g typescript-axios \
  -o packages/api-client/src
```

## Формат ошибок
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Неверные входные данные",
    "details": [
      { "field": "email", "message": "Неверный формат email" }
    ]
  }
}
```

## Пагинация
```
GET /api/v1/schedule/my?page=1&limit=20&sort=startTime&order=asc
```

Ответ:
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

## Преимущества
1. Документация всегда актуальна
2. Автоматическая генерация клиентов
3. Единый контракт для всех потребителей
4. Упрощение code review

## Недостатки
1. Зависимость от декораторов NestJS
2. Сложные кастомные типы могут потребовать ручной настройки

## Связанные решения
- ADR-0001: Модульный монолит
- ADR-0005: Стек технологий