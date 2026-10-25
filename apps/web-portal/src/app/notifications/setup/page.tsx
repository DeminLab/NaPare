import type { Metadata } from 'next';
import Link from 'next/link';
import WebPushSetup from './WebPushSetup';
import styles from '../../privacy/account/account-data.module.css';

export const metadata: Metadata = { title: 'Уведомления браузера — НаПаре', robots: { index: false, follow: false } };
export default function Page() {
  return <main className={styles.page}><div className={styles.document}>
    <Link href="/connections">← Подключения аккаунта</Link>
    <p className={styles.eyebrow}>Уведомления на этом устройстве</p><h1>Уведомления браузера</h1>
    <p>Получайте нейтральные сообщения об обновлениях в НаПаре. Имена, учебные сведения и тексты сообщений на экране блокировки не показываются.</p>
    <WebPushSetup />
    <p className={styles.support}><Link href="/">Открыть НаПаре</Link> · <Link href="/privacy/account">Управление данными аккаунта</Link></p>
  </div></main>;
}
