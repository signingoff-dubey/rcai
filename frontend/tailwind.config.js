/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        rcai: {
          bg: 'var(--rcai-bg)',
          card: 'var(--rcai-card)',
          elevated: 'var(--rcai-elevated)',
          border: 'var(--rcai-border)',
          accent: 'var(--rcai-accent)',
          danger: 'var(--rcai-danger)',
          warning: 'var(--rcai-warning)',
          success: 'var(--rcai-success)',
          purple: 'var(--rcai-purple)',
          'text-primary': 'var(--rcai-text-primary)',
          'text-secondary': 'var(--rcai-text-secondary)',
          'text-muted': 'var(--rcai-text-muted)',
        },
      },
      fontFamily: {
        display: ['JetBrains Mono', 'monospace'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
