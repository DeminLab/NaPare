'use client';

import { useEffect } from 'react';

export function PwaRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/student/sw.js', { scope: '/student/', updateViaCache: 'none' });
  }, []);

  return null;
}
