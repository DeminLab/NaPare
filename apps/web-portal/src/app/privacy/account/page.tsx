import type { Metadata } from 'next';
import Link from 'next/link';
import AccountDataControls from './AccountDataControls';
import styles from './account-data.module.css';

export const metadata: Metadata = {
  title: 'Данные аккаунта — НаПаре',
  robots: { index: false, follow: false },
};

export default function AccountDataPage() {
  return <main className={styles.page}>
    <div className={styles.document}>
      <Link href="/privacy">← Политика конфиденциальности</Link>
      <p className={styles.eyebrow}>Управление личными данными</p>
      <h1>Данные аккаунта</h1>
      <p>Скачайте копию своих данных или закройте аккаунт. Перед удалением вы увидите, какие записи сохраняются у организации.</p>
      <AccountDataControls />
      <p className={styles.support}>Для исправления данных и вопросов об оставшихся копиях: <a href="mailto:support@napare.ru">support@napare.ru</a>.</p>
    </div>
  </main>;
}
