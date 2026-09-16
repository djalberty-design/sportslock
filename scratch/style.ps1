$css = @"
@import "tailwindcss";

@theme {
  --color-obsidian: #0A0A0A;
  --color-panel: #171717;
  --color-panel-border: #262626;
  --color-neon: #39FF14;
  --color-crimson: #FF3131;
  --color-muted: #A3A3A3;
  --color-ink: #FAFAFA;
  
  --color-faint: #6e6b66;
  --color-line: #262626;
  --color-up: #3fa36a;
  --color-down: #FF3131;
  --color-background: #0A0A0A;
  --color-foreground: #FAFAFA;
  --color-primary: #39FF14;
  --color-primary-foreground: #0A0A0A;
  --color-border: #262626;
  --color-ring: #39FF14;

  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, "Roboto Mono", "SFMono-Regular", monospace;
  --font-mono-numbers: ui-monospace, "Roboto Mono", "SFMono-Regular", monospace;

  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  --shadow-paper: 0px 4px 24px -8px rgba(0, 0, 0, 0.7);
  --shadow-paper-hover: 0px 8px 32px -12px rgba(0, 0, 0, 0.85);
  --shadow-stamp: 0px 0px 0px 1px rgba(57, 255, 20, 0.3);

  --ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1);
}

@layer base {
  html {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  html,
  body,
  #app {
    min-height: 100%;
    background: var(--color-obsidian);
    color: var(--color-ink);
  }
  body {
    font-family: var(--font-sans);
    line-height: 1.5;
    background-color: var(--color-obsidian);
    background-image:
      radial-gradient(ellipse 80% 50% at 50% -10%, rgba(57, 255, 20, 0.05), transparent 55%);
    background-attachment: fixed;
  }
  h1,
  h2,
  h3 {
    font-family: var(--font-display);
    text-wrap: balance;
    letter-spacing: 0.02em;
    line-height: 1.15;
  }
  p {
    text-wrap: pretty;
  }
  button:not(:disabled),
  [role="button"]:not(:disabled) {
    cursor: pointer;
  }
  :focus-visible {
    outline: 2px solid var(--color-neon);
    outline-offset: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

.paper-card {
  background: var(--color-panel);
  border: 1px solid var(--color-panel-border);
  box-shadow: var(--shadow-paper);
  border-radius: var(--radius-lg);
  transition: box-shadow 150ms var(--ease-out-soft), border-color 150ms var(--ease-out-soft);
}

.stamp {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.table-cell {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-panel-border);
}
"@
Set-Content src/styles.css $css
