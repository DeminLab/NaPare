'use client';
import { usePathname } from 'next/navigation';
import { CurationEntry } from '@napare/ui/curation';
import { apiFetch } from '@/lib/api';
export function CurationAccess() {
  const pathname = usePathname();
  return pathname.endsWith('/curation') ? null : <CurationEntry apiFetch={apiFetch} basePath="/student" />;
}
