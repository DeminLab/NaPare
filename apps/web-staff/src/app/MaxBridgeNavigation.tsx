'use client';

import { MaxBridgeBackButton } from '@napare/ui';
import Script from 'next/script';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const HOME_PATH = '/today';
const AUTH_PATHS = new Set(['/login', '/register']);

export function MaxBridgeNavigation() {
  const [bridgeReady, setBridgeReady] = useState(false);
  const pathname = usePathname() || HOME_PATH;
  const router = useRouter();
  const pathStack = useRef<string[]>([]);

  useEffect(() => {
    const stack = pathStack.current;
    if (stack.at(-1) === pathname) return;
    if (stack.length > 1 && stack.at(-2) === pathname) stack.pop();
    else stack.push(pathname);
  }, [pathname]);

  const goBack = useCallback(() => {
    const stack = pathStack.current;
    if (stack.length > 1) {
      stack.pop();
      router.back();
    } else {
      router.replace(HOME_PATH);
    }
  }, [router]);

  return <><Script src="https://st.max.ru/js/max-web-app.js" strategy="afterInteractive" onReady={() => setBridgeReady(true)} /><MaxBridgeBackButton visible={bridgeReady && !AUTH_PATHS.has(pathname) && pathname !== HOME_PATH} onBack={goBack} /></>;
}
