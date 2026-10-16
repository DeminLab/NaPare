import type { Metadata } from 'next';
import StudentShell from '@/components/navigation/StudentShell';
import { MaxBridgeNavigation } from './MaxBridgeNavigation';
import { StudentAppearanceProvider } from './StudentAppearanceProvider';
import { PwaRegistration } from './PwaRegistration';
import { CurationAccess } from './CurationAccess';

export const metadata: Metadata = { manifest: '/student/manifest.webmanifest' };

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentAppearanceProvider><PwaRegistration /><StudentShell><div className="student-content"><CurationAccess />{children}</div></StudentShell><MaxBridgeNavigation /></StudentAppearanceProvider>;
}
