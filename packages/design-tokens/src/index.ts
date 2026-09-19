export const designTokens = {
  colors: {
    background: 'var(--color-background)',
    surface: 'var(--color-surface)',
    surfaceSecondary: 'var(--color-surface-secondary)',
    text: 'var(--color-text)',
    textSecondary: 'var(--color-text-secondary)',
    border: 'var(--color-border)',
    brand: 'var(--color-brand)',
    brandStrong: 'var(--color-brand-strong)',
    brandSoft: 'var(--color-brand-soft)',
    success: 'var(--color-success)',
    successSoft: 'var(--color-success-soft)',
    warning: 'var(--color-warning)',
    warningSoft: 'var(--color-warning-soft)',
    danger: 'var(--color-danger)',
    dangerSoft: 'var(--color-danger-soft)',
    info: 'var(--color-info)',
    infoSoft: 'var(--color-info-soft)',
  },
  radius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', xl: 'var(--radius-xl)' },
  shadow: { sm: 'var(--shadow-sm)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)' },
  motion: { fast: 'var(--motion-fast)', normal: 'var(--motion-normal)', slow: 'var(--motion-slow)', ease: 'var(--motion-ease)' },
  zIndex: { base: 'var(--z-base)', sticky: 'var(--z-sticky)', overlay: 'var(--z-overlay)', modal: 'var(--z-modal)', toast: 'var(--z-toast)' },
} as const;

export type SemanticColor = keyof typeof designTokens.colors;
