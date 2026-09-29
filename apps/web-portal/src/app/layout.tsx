import type { Metadata } from 'next';
import Script from 'next/script';
import './portal.css';

export const metadata: Metadata = {
  title: 'НаПаре',
  description: 'Единая цифровая среда университета',
  icons: {
    icon: '/brand/np-mark.png',
    apple: '/brand/np-mark.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body><Script src="https://st.max.ru/js/max-web-app.js" strategy="beforeInteractive" />{children}</body></html>;
}
