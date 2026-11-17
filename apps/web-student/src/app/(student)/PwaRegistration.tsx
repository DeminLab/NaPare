'use client';

import { useEffect } from 'react';
import { apiFetch, getToken, type PaginatedResponse } from '@/lib/api';
import { OFFLINE_CACHE, offlineOwner } from './offline-schedule';
import type { ScheduleV2Response } from './schedule-read-model';

async function weekLessonIds(from: string, to: string): Promise<string[]> {
  try {
    const response = await apiFetch<ScheduleV2Response>(`/schedule/v2?from=${from}&to=${to}`);
    if (Array.isArray(response.days)) {
      return response.days.flatMap(day => day.lessons.map(entry => entry.lessonId))
        .filter((id): id is string => /^[\da-f-]{36}$/i.test(id || ''));
    }
  } catch {
    // Fall through to the legacy endpoint.
  }
  const legacy = await apiFetch<PaginatedResponse<{ id: string }>>(`/schedule/range?startDate=${from}&endDate=${to}&limit=100`);
  return legacy.data.map(lesson => lesson.id).filter(id => /^[\da-f-]{36}$/i.test(id));
}

async function primeWeek(active: () => boolean) {
  const token = getToken();
  if (!token || !active()) return;
  const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const lessonIds = [...new Set(await weekLessonIds(iso(start), iso(end)))];
  const cache = 'caches' in window ? await caches.open(OFFLINE_CACHE).catch(() => null) : null;
  for (const lessonId of lessonIds.slice(0, 60)) {
    if (!active() || offlineOwner(getToken()) !== offlineOwner(token)) break;
    const path = `/pair-spaces/${lessonId}`;
    const key = `${location.origin}/student/__offline__/${offlineOwner(token)}/${encodeURIComponent('/api/v1' + path)}`;
    const saved = await cache?.match(key).then(response => response?.json()).catch(() => null);
    if (saved?.savedAt > Date.now() - 15 * 60 * 1000) continue;
    await apiFetch(path).catch(() => undefined);
  }
}

export function PwaRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let active = true;
    let primed = false;
    const prime = () => {
      if (primed || !navigator.serviceWorker.controller) return;
      primed = true;
      void primeWeek(() => active).catch(() => undefined);
    };
    navigator.serviceWorker.addEventListener('controllerchange', prime);
    void navigator.serviceWorker.register('/student/sw.js', { scope: '/student/', updateViaCache: 'none' }).then(prime).catch(() => undefined);
    return () => { active = false; navigator.serviceWorker.removeEventListener('controllerchange', prime); };
  }, []);

  return null;
}
