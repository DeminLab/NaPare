import type { Metadata } from 'next';
import StudentShell from '@/components/navigation/StudentShell';
import { MaxBridgeNavigation } from './MaxBridgeNavigation';
import { StudentAppearanceProvider } from './StudentAppearanceProvider';
import { PwaRegistration } from './PwaRegistration';

export const metadata: Metadata = { manifest: '/manifest.webmanifest' };

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentAppearanceProvider><PwaRegistration /><StudentShell>{children}</StudentShell><MaxBridgeNavigation /></StudentAppearanceProvider>;
}
