import * as bcrypt from 'bcrypt';
import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from '../apps/backend/src/users/entities/user.entity';
import { University } from '../apps/backend/src/users/entities/university.entity';
import { UserRole } from '../apps/backend/src/auth/interfaces/user-role';

const SALT_ROUNDS = 10;
const PASSWORD = 'password123';

async function main() {
  const dbConfig: DataSourceOptions = {
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
    database: 'napare',
    entities: [User, University],
    synchronize: false,
  };

  const dataSource = new DataSource(dbConfig);
  await dataSource.initialize();

  const userRepository = dataSource.getRepository(User);
  const universityRepository = dataSource.getRepository(University);

  console.log('🧹 Очистка существующих данных...');

  // Удаляем всех пользователей
  await userRepository.delete({});
  console.log('✅ Пользователи удалены');

  // Удаляем все университеты
  await universityRepository.delete({});
  console.log('✅ Университеты удалены');

  console.log('✅ База данных очищена');
  console.log('\n📊 Статистика:');
  const userCount = await userRepository.count();
  const universityCount = await universityRepository.count();
  console.log(`   Пользователей: ${userCount}`);
  console.log(`   Университетов: ${universityCount}`);

  await dataSource.destroy();
}

main()
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
