// Vanta-style Design Tokens
// Comprehensive design token system for LinkedProcurement
// These tokens complement the existing dashboardTheme and tailwind config

export const designTokens = {
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1e40af',  // Primary brand color
      800: '#1e3a8a',
      900: '#1e2f6d',
      950: '#172554',
    },
    neutral: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617',
    },
    success: { light: '#dcfce7', DEFAULT: '#22c55e', dark: '#15803d' },
    warning: { light: '#fef3c7', DEFAULT: '#f59e0b', dark: '#b45309' },
    error: { light: '#fee2e2', DEFAULT: '#ef4444', dark: '#b91c1c' },
    info: { light: '#dbeafe', DEFAULT: '#3b82f6', dark: '#1d4ed8' },
  },
  spacing: {
    page: { x: '1.5rem', y: '2rem' },
    card: { x: '1.5rem', y: '1.25rem' },
    section: '2rem',
  },
  borderRadius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
  shadows: {
    card: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    elevated: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    modal: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
  typography: {
    heading: { fontFamily: "'Inter', sans-serif", fontWeight: '700' },
    body: { fontFamily: "'Inter', sans-serif", fontWeight: '400' },
    mono: { fontFamily: "'JetBrains Mono', monospace", fontWeight: '400' },
  },
} as const;

export type DesignTokens = typeof designTokens;
