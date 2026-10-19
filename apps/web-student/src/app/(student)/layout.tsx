import type { Metadata } from 'next';
import StudentShell from '@/components/navigation/StudentShell';
import { MaxBridgeNavigation } from './MaxBridgeNavigation';
import { StudentAppearanceProvider } from './StudentAppearanceProvider';
import { PwaRegistration } from './PwaRegistration';

export const metadata: Metadata = { manifest: '/student/manifest.webmanifest', icons: { icon: '/student/icon.svg', shortcut: '/student/icon.svg' } };

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentAppearanceProvider><PwaRegistration /><StudentShell><div className="student-content">{children}</div></StudentShell><MaxBridgeNavigation /></StudentAppearanceProvider>;
}
