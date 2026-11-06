import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runCommand(command: string, description: string) {
  console.log(`\n🚀 ${description}...`);
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    console.log(`✅ ${description} выполнено`);
    return true;
  } catch (error: any) {
    console.error(`❌ ${description} не выполнено:`, error.message);
    return false;
  }
}

async function main() {
  console.log('=== Очистка и инициализация базы данных ===\n');

  const steps = [
    {
      command: 'cd /home/danila/server/NaPare && docker compose -f docker-compose.migrate.yml down -v',
      description: 'Остановка и очистка контейнеров',
    },
    {
      command: 'cd /home/danila/server/NaPare && docker compose -f docker-compose.migrate.yml up --build -d',
      description: 'Запуск миграций',
    },
    {
      command: 'cd /home/danila/server/NaPare && npx ts-node scripts/clean-db.ts',
      description: 'Очистка БД',
    },
    {
      command: 'cd /home/danila/server/NaPare && npx ts-node scripts/init-users.ts',
      description: 'Создание пользователей',
    },
  ];

  for (const step of steps) {
    const success = await runCommand(step.command, step.description);
    if (!success) {
      console.error('\n❌ Процесс прерван на этапе:', step.description);
      process.exit(1);
    }
  }

  console.log('\n=== Все этапы выполнены успешно! ===\n');

  // Показать созданные аккаунты
  console.log('📝 Созданные аккаунты:');
  console.log('   Портал (student view): portal@example.com / password123');
  console.log('   Student (student view): student@example.com / password123');
  console.log('   Staff (teacher view): staff@example.com / password123');
  console.log('   Admin (admin view): admin@example.com / password123');
  console.log('   Developer (developer view): developer@example.com / password123\n');

  // Остановить миграционные контейнеры
  await runCommand(
    'cd /home/danila/server/NaPare && docker compose -f docker-compose.migrate.yml down',
    'Остановка миграционных контейнеров'
  );

  console.log('\n🎉 База данных полностью пересобрана с нуля!');
  console.log('   - Все контейнеры остановлены');
  console.log('   - Volumes удалены');
  console.log('   - Миграции выполнены');
  console.log('   - Пользователи созданы для всех фронтендов');
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
