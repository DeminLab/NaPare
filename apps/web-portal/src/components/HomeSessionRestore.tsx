'use client';

import { useEffect, useState } from 'react';

const destinations: Record<string, string> = {
  student: '/student/today',
  teacher: '/staff/today',
  curator: '/staff/today',
  faculty_dean: '/staff/today',
  department_head: '/staff/today',
  university_admin: '/deanery/dashboard',
  superadmin: '/deanery/dashboard',
  developer: '/developer/api',
  employer: '/career',
  career_staff: '/career',
  career_admin: '/career',
};

/** Routes an existing website session to its role cabinet before showing the public home page. */
export function HomeSessionRestore() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setReady(true);
      controller.abort();
    }, 8000);
    const restore = async () => {
      let accessToken = window.localStorage.getItem('accessToken');
      const refreshToken = window.localStorage.getItem('refreshToken');
      if (!accessToken || !refreshToken) {
        setReady(true);
        return;
      }

      try {
        let response = await fetch('/api/v1/users/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });

        if (response.status === 401) {
          const refreshed = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
            signal: controller.signal,
          });
          const tokens = await refreshed.json().catch(() => null) as { accessToken?: string; refreshToken?: string } | null;
          if (!refreshed.ok || !tokens?.accessToken || !tokens.refreshToken) {
            setReady(true);
            return;
          }
          accessToken = tokens.accessToken;
          window.localStorage.setItem('accessToken', tokens.accessToken);
          window.localStorage.setItem('refreshToken', tokens.refreshToken);
          response = await fetch('/api/v1/users/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal,
          });
        }

        if (response.ok) {
          const user = await response.json() as { role?: string };
          const destination = user.role ? destinations[user.role] : undefined;
          if (destination && !controller.signal.aborted) {
            window.location.replace(destination);
            return;
          }
        }
      } catch {
        // Keep the public home page available when the session service is unreachable.
      }
      if (!controller.signal.aborted) setReady(true);
    };

    void restore();
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  if (ready) return null;

  return (
    <div className="home-session-gate" role="status" aria-live="polite" aria-busy="true">
      <span className="home-session-spinner" aria-hidden="true" />
      <span>Открываем НаПаре…</span>
    </div>
  );
}
