'use client';

import { useTelemetry } from '@/lib/telemetry';
import type { ReactNode } from 'react';

export function TelemetryProvider({ children }: { children: ReactNode }) {
  useTelemetry();
  return <>{children}</>;
}
