'use client';

import { useEffect, useRef, useState } from 'react';

/** Restore filters on entry/back and keep the current view shareable without losing Next's history state. */
export function useWorkspaceQuery(values: Record<string, string>, restore: (query: URLSearchParams) => void) {
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const [ready, setReady] = useState(false);
  const restoring = useRef(false);
  const [restoreVersion, setRestoreVersion] = useState(0);
  const serialized = new URLSearchParams(values).toString();

  useEffect(() => {
    const read = () => {
      restoring.current = true;
      setRestoreVersion(version => version + 1);
      restoreRef.current(new URLSearchParams(window.location.search));
      setReady(true);
    };
    restoreRef.current(new URLSearchParams(window.location.search));
    setReady(true);
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (restoring.current) { restoring.current = false; return; }
    const url = new URL(window.location.href);
    new URLSearchParams(serialized).forEach((value, key) => {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    });
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
  }, [ready, serialized, restoreVersion]);
  return ready;
}
