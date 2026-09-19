module.exports = {
  theme: {
    extend: {
      colors: {
        surface: 'var(--color-surface)',
        'surface-secondary': 'var(--color-surface-secondary)',
        ink: 'var(--color-text)',
        muted: 'var(--color-text-secondary)',
        border: 'var(--color-border)',
        brand: 'var(--color-brand)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)',
        primary: { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81' },
      },
      borderRadius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', xl: 'var(--radius-xl)' },
      boxShadow: { ds: 'var(--shadow-sm)', 'ds-md': 'var(--shadow-md)', 'ds-lg': 'var(--shadow-lg)' },
      transitionTimingFunction: { ds: 'var(--motion-ease)' },
    },
  },
};
