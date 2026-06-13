/**
 * Theme loader.
 *
 * Themes are loaded at build time via `import.meta.glob('/public/themes/*.css', { query: '?raw' })`.
 * Custom themes require a rebuild — runtime theme loading is not supported.
 * The set of available themes is frozen at the time Vite produces the bundle.
 */

import type { ThemeInfo } from './types'

const BUILT_IN_THEME_ID = 'built-in'

let cachedThemes: ThemeInfo[] | null = null
const cachedCSS: Map<string, string> = new Map()

export function extractThemeName(css: string, filename: string): { name: string; isDark: boolean } {
  const themeCommentMatch = css.match(/\/\*\s*Theme:\s*(.+?)\s*(?:\|?\s*(dark|light))?\s*\*\//i)

  if (themeCommentMatch) {
    const name = themeCommentMatch[1].trim()
    const mode = themeCommentMatch[2]?.toLowerCase()
    return {
      name,
      isDark: mode === 'dark',
    }
  }

  const nameWithoutExt = filename.replace(/\.css$/, '')
  const name = nameWithoutExt
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return { name, isDark: false }
}

export async function loadThemes(): Promise<ThemeInfo[]> {
  if (cachedThemes) {
    return cachedThemes
  }

  const themes: ThemeInfo[] = [
    {
      id: BUILT_IN_THEME_ID,
      name: 'Default Light',
      isDark: false,
    },
  ]

  const themeFiles = import.meta.glob('/public/themes/*.css', {
    query: '?raw',
    import: 'default',
    eager: true,
  })

  for (const path in themeFiles) {
    const css = themeFiles[path] as string
    const filename = path.split('/').pop() || ''
    const themeId = filename.replace(/\.css$/, '')
    const { name, isDark } = extractThemeName(css, filename)

    themes.push({
      id: themeId,
      name,
      isDark,
    })

    cachedCSS.set(themeId, css)
  }

  cachedThemes = themes
  return themes
}

export function getThemeCSS(themeId: string): string {
  if (themeId === BUILT_IN_THEME_ID) {
    return ''
  }

  return cachedCSS.get(themeId) || ''
}

export async function refetchThemes(): Promise<void> {
  cachedThemes = null
  cachedCSS.clear()
  await loadThemes()
}

export function getBuiltInThemeCSS(): string {
  return `/* ---- Editorial Theme (Default Light) ---- */
:root,
[data-theme='light'] {
  /* Color Palette */
  --canvas: #faf8f3;
  --panel: #ffffff;
  --side: #f6f3ed;
  --ink: #2c2823;
  --ink-2: #6f6a62;
  --ink-3: #a39d93;
  --line: rgba(44, 40, 33, 0.09);
  --line-2: rgba(44, 40, 33, 0.05);
  --accent: #b07d4f;
  --accent-soft: #efe7db;

  /* Legacy tokens */
  --color-bg-primary: var(--canvas);
  --color-bg-secondary: var(--panel);
  --color-bg-tertiary: #f3f0ea;
  --color-bg-hover: rgba(44, 40, 33, 0.04);
  --color-bg: var(--canvas);

  /* Text */
  --color-text-primary: var(--ink);
  --color-text-secondary: var(--ink-2);
  --color-text-muted: var(--ink-3);

  /* Borders */
  --color-border: var(--line);
  --color-border-light: var(--line-2);
  --color-border-subtle: var(--line-2);
  --color-border-visible: var(--line);
  --color-border-glass: var(--line);

  /* Accent */
  --color-accent: var(--accent);
  --color-accent-hover: #9a6c42;
  --color-accent-light: var(--accent-soft);

  /* Status */
  --color-success: #5d9a78;
  --color-warning: #bf944e;
  --color-error: #c2697f;
  --color-info: #5b7fb5;
  --color-terracotta: var(--accent);
  --color-terracotta-hover: #9a6c42;

  /* Surfaces */
  --color-surface: var(--panel);
  --color-surface-raised: var(--panel);
  --color-surface-glass: rgba(255, 255, 255, 0.8);

  /* Overlay */
  --color-overlay: rgba(44, 40, 33, 0.4);

  /* Focus */
  --color-focus: var(--accent);

  /* Scrollbar */
  --color-scrollbar: #d5d0c8;
  --color-scrollbar-hover: #a39d93;

  /* Typography */
  --font-serif: 'Newsreader', Georgia, 'Times New Roman', serif;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;

  /* Event card theming */
  --ink-raw: 44, 40, 33;
  --event-bg-mix: 9%;
  --event-bg-mix-hover: 12%;
  --color-error-muted: #c47068;

  /* Modal / popover tokens */
  --modal-bg: var(--color-bg-secondary);
  --popover-bg: var(--color-surface-raised);
  --modal-scrim: rgba(26, 26, 26, 0.25);
  --modal-blur: blur(3px);
  --modal-border: rgba(0, 0, 0, 0.06);
  --popover-border: rgba(0, 0, 0, 0.08);
  --modal-shadow: 0 24px 80px rgba(0, 0, 0, 0.18), 0 6px 20px rgba(0, 0, 0, 0.10);

  /* Shadows */
  --shadow-event: 0 1px 2px rgba(44, 40, 33, 0.04);
  --shadow-event-hover: 0 4px 12px rgba(44, 40, 33, 0.08);
  --shadow-card: 0 1px 2px rgba(44, 40, 33, 0.04), 0 6px 16px rgba(44, 40, 33, 0.03);
  --shadow-sidebar: none;
  --shadow-topbar: none;
  --shadow-today: none;
  --shadow-glass: none;
  --shadow-inset: inset 0 1px 2px rgba(44, 40, 33, 0.06);

  /* Spacing */
  --sidebar-width: 300px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;

  /* Border Radius */
  --radius-sm: 7px;
  --radius-md: 11px;
  --radius-lg: 16px;
}

/* ---- Dark Theme ---- */
[data-theme='dark'] {
  --canvas: #1a1816;
  --panel: #242220;
  --side: #1e1c1a;
  --ink: #f0ece6;
  --ink-2: #a39d93;
  --ink-3: #6f6a62;
  --line: rgba(240, 236, 230, 0.09);
  --line-2: rgba(240, 236, 230, 0.05);
  --accent: #c9956a;
  --accent-soft: rgba(201, 149, 106, 0.12);

  --color-bg-primary: var(--canvas);
  --color-bg-secondary: var(--panel);
  --color-bg-tertiary: #2a2826;
  --color-bg-hover: rgba(240, 236, 230, 0.06);
  --color-bg: var(--canvas);
  --color-text-primary: var(--ink);
  --color-text-secondary: var(--ink-2);
  --color-text-muted: var(--ink-3);
  --color-border: var(--line);
  --color-border-light: var(--line-2);
  --color-border-subtle: var(--line-2);
  --color-border-visible: var(--line);
  --color-accent: var(--accent);
  --color-accent-hover: #d4a575;
  --color-accent-light: var(--accent-soft);
  --color-surface: var(--panel);
  --color-surface-raised: var(--panel);
  --color-surface-glass: rgba(36, 34, 32, 0.8);
  --shadow-event: 0 1px 2px rgba(0, 0, 0, 0.12);
  --shadow-event-hover: 0 4px 12px rgba(0, 0, 0, 0.2);
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.12), 0 6px 16px rgba(0, 0, 0, 0.08);

  /* Event card theming */
  --ink-raw: 240, 236, 230;
  --event-bg-mix: 18%;
  --event-bg-mix-hover: 22%;
  --color-error-muted: #d4877f;

  /* Modal / popover tokens */
  --modal-bg: #2d2a24;
  --popover-bg: #383229;
  --modal-scrim: rgba(0, 0, 0, 0.60);
  --modal-blur: blur(4px);
  --modal-border: rgba(255, 247, 235, 0.10);
  --popover-border: rgba(255, 247, 235, 0.14);
  --modal-shadow: 0 2px 4px rgba(0, 0, 0, 0.40), 0 20px 60px rgba(0, 0, 0, 0.65);
  --shadow-inset: inset 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* Global scrollbar — thumb hidden until hover, space always reserved */
* {
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

*:hover {
  scrollbar-color: var(--color-scrollbar) transparent;
}

*::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

*::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
}

*:hover::-webkit-scrollbar-thumb {
  background: var(--color-scrollbar);
}

*::-webkit-scrollbar-thumb:hover {
  background: var(--color-scrollbar-hover);
}`
}
