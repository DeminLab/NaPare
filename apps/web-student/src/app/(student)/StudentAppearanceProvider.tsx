'use client';

import { useEffect, type ReactNode } from 'react';

interface AppearanceSettings {
  theme?: 'light' | 'dark' | 'system';
  accent?: 'blue' | 'indigo' | 'violet' | 'emerald';
  compactMode?: boolean;
}

function readAppearanceSettings(): AppearanceSettings {
  try {
    const value = window.localStorage.getItem('napare:student-settings');
    return value ? JSON.parse(value) as AppearanceSettings : {};
  } catch {
    return {};
  }
}

export function StudentAppearanceProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const settings = readAppearanceSettings();
      const theme = settings.theme === 'system' || settings.theme === 'dark' ? settings.theme : 'light';
      root.dataset.studentTheme = theme;
      root.dataset.studentPalette = theme === 'dark' || (theme === 'system' && media.matches) ? 'dark' : 'light';
      root.dataset.studentAccent = ['blue', 'indigo', 'violet', 'emerald'].includes(settings.accent || '') ? settings.accent : 'indigo';
      root.dataset.studentCompact = settings.compactMode === true ? 'true' : 'false';
    };
    const onSettingsUpdate = () => apply();

    apply();
    window.addEventListener('napare:student-settings-updated', onSettingsUpdate);
    window.addEventListener('storage', onSettingsUpdate);
    media.addEventListener('change', onSettingsUpdate);
    return () => {
      window.removeEventListener('napare:student-settings-updated', onSettingsUpdate);
      window.removeEventListener('storage', onSettingsUpdate);
      media.removeEventListener('change', onSettingsUpdate);
      delete root.dataset.studentTheme;
      delete root.dataset.studentPalette;
      delete root.dataset.studentAccent;
      delete root.dataset.studentCompact;
    };
  }, []);

  return children;
}
