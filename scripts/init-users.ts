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

  // Удаляем всех пользователей (кроме тех, кто может быть нужен для миграций)
  await userRepository.delete({});

  // Удаляем все университеты
  await universityRepository.delete({});

  console.log('✅ База данных очищена');

  console.log('🏫 Создание университета...');
  const university = universityRepository.create({
    name: 'Test University',
    city: 'Moscow',
    status: 'active',
  });
  const savedUniversity = await universityRepository.save(university);
  console.log(`✅ Университет создан: ${savedUniversity.name} (ID: ${savedUniversity.id})`);

  // Хешируем пароль
  const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

  console.log('\n👤 Создание пользователей для всех фронтендов:\n');

  // Пользователи для каждого фронтенда
  const usersData = [
    {
      email: 'portal@example.com',
      firstName: 'Portal',
      lastName: 'User',
      role: UserRole.STUDENT,
      description: 'Web Portal (student view)',
    },
    {
      email: 'student@example.com',
      firstName: 'Student',
      lastName: 'User',
      role: UserRole.STUDENT,
      description: 'Web Student (student view)',
    },
    {
      email: 'staff@example.com',
      firstName: 'Staff',
      lastName: 'User',
      role: UserRole.TEACHER,
      description: 'Web Staff (teacher view)',
    },
    {
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.UNIVERSITY_ADMIN,
      description: 'Web Admin (admin view)',
    },
    {
      email: 'developer@example.com',
      firstName: 'Developer',
      lastName: 'User',
      role: UserRole.DEVELOPER,
      description: 'Web Developer (developer view)',
    },
  ];

  for (const userData of usersData) {
    const user = userRepository.create({
      email: userData.email,
      passwordHash,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      universityId: savedUniversity.id,
      isActive: true,
    });

    const savedUser = await userRepository.save(user);
    console.log(`✅ ${userData.description}`);
    console.log(`   Email: ${savedUser.email}`);
    console.log(`   Password: ${PASSWORD}`);
    console.log(`   Role: ${savedUser.role}`);
    console.log(`   ID: ${savedUser.id}`);
    console.log('');
  }

  console.log('🎉 Все аккаунты созданы успешно!');
  console.log('\n📝 Информация для входа:');
  console.log('   Портал (student view): portal@example.com / password123');
  console.log('   Student (student view): student@example.com / password123');
  console.log('   Staff (teacher view): staff@example.com / password123');
  console.log('   Admin (admin view): admin@example.com / password123');
  console.log('   Developer (developer view): developer@example.com / password123\n');

  await dataSource.destroy();
}

main()
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
