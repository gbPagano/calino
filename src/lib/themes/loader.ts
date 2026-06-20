/**
 * Theme loader.
 *
 * Themes are loaded at build time via `import.meta.glob('/public/themes/*.css', { query: '?raw' })`.
 * Custom themes require a rebuild — runtime theme loading is not supported.
 * The set of available themes is frozen at the time Vite produces the bundle.
 */

import type { ThemeInfo } from './types'

const BUILT_IN_THEME_ID = 'built-in'
const BUILT_IN_DARK_THEME_ID = 'built-in-dark'

let cachedThemes: ThemeInfo[] | null = null
const cachedCSS: Map<string, string> = new Map()

export function extractThemeName(css: string, filename: string): { name: string; isDark: boolean; isBoth: boolean } {
  const themeCommentMatch = css.match(/\/\*\s*Theme:\s*(.+?)\s*(?:\|?\s*(dark|light|both))?\s*\*\//i)

  if (themeCommentMatch) {
    const name = themeCommentMatch[1].trim()
    const mode = themeCommentMatch[2]?.toLowerCase()
    return {
      name,
      isDark: mode === 'dark',
      isBoth: mode === 'both',
    }
  }

  const nameWithoutExt = filename.replace(/\.css$/, '')
  const name = nameWithoutExt
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return { name, isDark: false, isBoth: false }
}

function extractCSSSection(css: string, mode: 'light' | 'dark'): string {
  const lines = css.split('\n')
  const result: string[] = []
  let inSection = false
  let braceDepth = 0

  for (const line of lines) {
    const matchesMode = line.includes(`[data-theme='${mode}']`)
    const matchesRoot = mode === 'light' && line.includes(':root,') && !line.includes('data-theme-id')

    if (matchesMode || matchesRoot) {
      inSection = true
      braceDepth = 0
    }

    if (inSection) {
      result.push(line)
      braceDepth += (line.match(/\{/g) || []).length
      braceDepth -= (line.match(/\}/g) || []).length

      if (braceDepth <= 0 && result.length > 1) {
        inSection = false
      }
    }
  }

  return result.join('\n') || css
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
    {
      id: BUILT_IN_DARK_THEME_ID,
      name: 'Default Dark',
      isDark: true,
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
    const { name, isDark, isBoth } = extractThemeName(css, filename)

    if (isBoth) {
      themes.push({ id: `${themeId}-light`, name, isDark: false })
      themes.push({ id: `${themeId}-dark`, name, isDark: true })
      cachedCSS.set(`${themeId}-light`, css)
      cachedCSS.set(`${themeId}-dark`, css)
    } else {
      themes.push({ id: themeId, name, isDark })
      cachedCSS.set(themeId, css)
    }
  }

  cachedThemes = themes
  return themes
}

const BUILT_IN_DARK_CSS = `--canvas: #1a1816; --panel: #242220; --ink: #f0ece6; --accent: #c9956a; --radius-sm: 7px; --radius-md: 11px; --radius-lg: 16px;`

/** Returns full CSS for DOM injection */
export function getThemeCSS(themeId: string): string {
  if (themeId === BUILT_IN_THEME_ID) {
    return ''
  }
  if (themeId === BUILT_IN_DARK_THEME_ID) {
    return BUILT_IN_DARK_CSS
  }

  return cachedCSS.get(themeId) || ''
}

/** Returns extracted CSS section for preview cards */
export function getThemePreviewCSS(themeId: string): string {
  if (themeId === BUILT_IN_THEME_ID) {
    return ''
  }
  if (themeId === BUILT_IN_DARK_THEME_ID) {
    return BUILT_IN_DARK_CSS
  }

  const fullCSS = cachedCSS.get(themeId) || ''
  const mode = themeId.endsWith('-dark') ? 'dark' : 'light'
  return extractCSSSection(fullCSS, mode)
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
  --event-border-radius: 7px;
  --event-gap: 3px;

  /* Motion */
  --duration-fast: 180ms;
  --duration-normal: 320ms;
  --ease-spring: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-out-soft: cubic-bezier(0.25, 0.46, 0.45, 0.94);

  /* Modal / popover tokens */
  --modal-bg: var(--color-bg-secondary);
  --popover-bg: var(--canvas);
  --popover-glass: rgba(250, 248, 243, 0.85);
  --modal-scrim: rgba(26, 26, 26, 0.25);
  --modal-blur: blur(3px);
  --modal-border: rgba(0, 0, 0, 0.06);
  --popover-border: rgba(0, 0, 0, 0.06);
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

  /* View Switcher */
  --view-switcher-indicator-height: 32px;

  /* Modal */
  --modal-card-border: 1px solid rgba(255, 255, 255, 0.4);
  --modal-save-shadow: 0 2px 8px rgba(196, 168, 154, 0.4);
  --modal-save-shadow-hover: 0 4px 14px rgba(196, 168, 154, 0.5);

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
  --event-border-radius: 7px;
  --event-gap: 3px;

  /* Motion */
  --duration-fast: 180ms;
  --duration-normal: 320ms;
  --ease-spring: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-out-soft: cubic-bezier(0.25, 0.46, 0.45, 0.94);

  /* Modal / popover tokens */
  --modal-bg: #2d2a24;
  --popover-bg: #383229;
  --popover-glass: rgba(56, 50, 41, 0.85);
  --modal-scrim: rgba(0, 0, 0, 0.60);
  --modal-blur: blur(4px);
  --modal-border: rgba(255, 247, 235, 0.10);
  --popover-border: rgba(255, 247, 235, 0.14);
  --modal-shadow: 0 2px 4px rgba(0, 0, 0, 0.40), 0 20px 60px rgba(0, 0, 0, 0.65);
  --shadow-inset: inset 0 1px 2px rgba(0, 0, 0, 0.2);

  /* View Switcher */
  --view-switcher-indicator-height: 32px;

  /* Modal */
  --modal-card-border: 1px solid rgba(255, 255, 255, 0.1);
  --modal-save-shadow: 0 2px 8px rgba(196, 168, 154, 0.2);
  --modal-save-shadow-hover: 0 4px 14px rgba(196, 168, 154, 0.3);
}

/* Global scrollbar — thumb hidden until hover */
* {
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
}

/* ── Modal card — double-bezel edge (default theme, light only) */
[data-theme='light']:not([data-theme-id]) [data-component="modal-card"] {
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.06),
    0 0 0 4px rgba(255, 255, 255, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    var(--modal-shadow);
}`
}
