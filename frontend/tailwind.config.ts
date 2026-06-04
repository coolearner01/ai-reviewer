import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // GitHub-dark palette (matches files/pr_reviewer_frontend_prompt.html)
        gh: {
          canvas: 'hsl(var(--gh-canvas))',
          surface: 'hsl(var(--gh-surface))',
          'surface-2': 'hsl(var(--gh-surface-2))',
          sidebar: 'hsl(var(--gh-sidebar))',
          border: 'hsl(var(--gh-border))',
          'border-muted': 'hsl(var(--gh-border-muted))',
          text: 'hsl(var(--gh-text))',
          'text-muted': 'hsl(var(--gh-text-muted))',
          'text-subtle': 'hsl(var(--gh-text-subtle))',
          accent: 'hsl(var(--gh-accent))',
          'accent-hover': 'hsl(var(--gh-accent-hover))',
          blue: 'hsl(var(--gh-blue))',
          'blue-muted': 'hsl(var(--gh-blue-muted))',
          red: 'hsl(var(--gh-red))',
          yellow: 'hsl(var(--gh-yellow))',
          purple: 'hsl(var(--gh-purple))',
          orange: 'hsl(var(--gh-orange))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
        mono: ['SFMono-Regular', 'JetBrains Mono', 'Consolas', 'Menlo', 'monospace'],
      },
      keyframes: {
        'gh-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'gh-pulse': 'gh-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
