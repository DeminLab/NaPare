'use client';
import { CurationWorkspace } from '@napare/ui/curation';
import { apiFetch } from '@/lib/api';
export default function CurationPage() { return <CurationWorkspace apiFetch={apiFetch} showCounts />; }
