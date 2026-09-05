# ADR-0002: Мультивузовость через university_id

## Статус
Принято

## Контекст
Продукт B2B2C: одна платформа → несколько вузов → студенты/преподаватели. Каждый вуз — изолированная тенанция со своей структурой (факультеты, группы, расписание).

## Решение
Реализовать мультивузовость через **university_id**:
- Каждая доменная сущность имеет `university_id UUID REFERENCES universities(id)`
- Все API-запросы фильтруются по `university_id` текущего пользователя
- Row Level Security (RLS) в PostgreSQL как дополнительная защита
- Guards в NestJS проверяют доступ к данным своего вуза

## Реализация

### База данных
```sql
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY university_isolation ON lessons
  USING (university_id = current_setting('app.university_id')::uuid);
```

### NestJS Guards
```typescript
@Injectable()
export class UniversityGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    request.query.university_id = user.universityId;
    return true;
  }
}
```

## Преимущества
1. Единая кодовая база для всех вузов
2. Изоляция данных на уровне БД
3. Простота добавления новых вузов
4. Возможность кросс-аналитики (с разрешения)

## Недостатки
1. Дополнительный параметр во всех запросах
2. Сложность агрегации данныхAcross Universities

## Связанные решения
- ADR-0001: Модульный монолит
- ADR-0003: JWT-авторизация