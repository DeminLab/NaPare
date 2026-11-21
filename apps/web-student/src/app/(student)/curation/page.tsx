'use client';
import { CurationWorkspace } from '@napare/ui/curation';
import { apiFetch } from '@/lib/api';
export default function CurationPage() { return <main className="student-curation-page student-content"><CurationWorkspace apiFetch={apiFetch} /></main>; }
