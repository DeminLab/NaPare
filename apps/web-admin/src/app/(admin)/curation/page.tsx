'use client';
import { CurationWorkspace } from '@napare/ui/curation';
import { apiFetch } from '@/lib/api';
export default function CurationPage() {
  return <div className="mx-auto max-w-[1500px] [&_.curation-workspace]:!max-w-none"><CurationWorkspace apiFetch={apiFetch} showCounts /></div>;
}
