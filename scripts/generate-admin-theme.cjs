// Generates app/assets/css/admin-theme.css from the installed Tailwind
// palette. Run from the repo root: node scripts/generate-admin-theme.cjs
// See the admin-theme skill for the palette choices and how they were
// validated.
const fs = require('node:fs')
const path = require('node:path')

const theme = fs.readFileSync(path.join(path.dirname(require.resolve('tailwindcss/package.json', { paths: [process.cwd()] })), 'theme.css'), 'utf8')
const v = (name) => theme.match(new RegExp(String.raw`--color-${name}: (oklch\([^)]*\))`))[1]
const roles = { primary: 'indigo', secondary: 'violet', success: 'green', info: 'blue', warning: 'amber', error: 'red', neutral: 'zinc' }
const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const scales = Object.entries(roles).map(([role, hue]) => `  /* ${role}: ${hue} */\n${shades.map((s) => `  --ui-color-${role}-${s}: ${v(`${hue}-${s}`)};`).join('\n')}`).join('\n\n')
const semantic = (shade) => Object.keys(roles).filter((r) => r !== 'neutral').map((r) => `  --ui-${r}: var(--ui-color-${r}-${shade});`).join('\n')
const n = (s) => `var(--ui-color-neutral-${s})`
const neutralLight = { 'text-dimmed': n(400), 'text-muted': n(500), 'text-toned': n(600), 'text': n(700), 'text-highlighted': n(900), 'text-inverted': '#fff', 'bg': '#fff', 'bg-muted': n(50), 'bg-elevated': n(100), 'bg-accented': n(200), 'bg-inverted': n(900), 'border': n(200), 'border-muted': n(200), 'border-accented': n(300), 'border-inverted': n(900) }
const neutralDark = { 'text-dimmed': n(500), 'text-muted': n(400), 'text-toned': n(300), 'text': n(200), 'text-highlighted': '#fff', 'text-inverted': n(900), 'bg': n(900), 'bg-muted': n(800), 'bg-elevated': n(800), 'bg-accented': n(700), 'bg-inverted': '#fff', 'border': n(800), 'border-muted': n(700), 'border-accented': n(700), 'border-inverted': '#fff' }
const tokens = (o) => Object.entries(o).map(([k, val]) => `  --ui-${k}: ${val};`).join('\n')
// Validated with the dataviz palette checks on white (light) and zinc-900
// (dark). Re-run the checks before you change a slot.
const chartLight = ['amber-600', 'teal-600', 'rose-500', 'sky-600', 'lime-700']
const chartDark = ['amber-600', 'teal-600', 'rose-500', 'sky-600', 'lime-600']
const chart = (list) => `  --ui-chart-1: var(--ui-primary);\n${list.map((c, i) => `  --ui-chart-${i + 2}: ${v(c)}; /* ${c} */`).join('\n')}`

const css = `/*
 * The Pluto admin theme.
 *
 * Two selectors carry it:
 * - \`:root[data-pluto-admin]\`: usePlutoAdminTheme() sets this attribute on
 *   <html> while an admin layout is mounted, so the theme also covers
 *   overlays (modals, slideovers, menus, toasts, the command palette) that
 *   render at the end of <body>.
 * - \`[data-pluto-admin-scope]\`: for admin chrome that also shows on the
 *   public site, such as the admin navbar for a logged-in admin.
 *
 * Every value is a literal. The consumer app styles its public site through
 * its own app.config colors and @theme. Both reach the admin unless the admin
 * pins its own values: app.config colors set Nuxt UI's --ui-color-* scales on
 * :root, and @theme can redefine a Tailwind color such as --color-red-400.
 * These selectors are more specific than Nuxt UI's :root and .dark rules.
 *
 * The semantic tokens (--ui-primary, --ui-bg, --ui-text, ...) are declared
 * again here, not only the color scales. A custom property inherits as a
 * resolved value, so on a scoped element the :root tokens would still hold
 * the app's colors.
 *
 * Chart colors are a validated categorical palette: lightness band, chroma
 * floor, colorblind separation, and 3:1 contrast pass on white (light) and
 * on zinc-900 (dark). This file is generated; keep the values in sync with
 * scripts/generate-admin-theme.cjs: run it from the repo root, never edit this
 * file by hand.
 */
:root[data-pluto-admin],
[data-pluto-admin-scope] {
${scales}

${semantic(500)}

${tokens(neutralLight)}

${chart(chartLight)}

  /* Surfaces */
  --pluto-admin-canvas: #fff;
  --pluto-admin-sidebar: ${v('zinc-50')};
  --pluto-admin-navbar: #fff;

  --ui-radius: 0.375rem;
  --font-sans: "Outfit", ui-sans-serif, system-ui, sans-serif;
}

:root[data-pluto-admin].dark,
.dark [data-pluto-admin-scope] {
${semantic(400)}

${tokens(neutralDark)}

${chart(chartDark)}

  /* Cards (--ui-bg, zinc-900) sit one step above the canvas (zinc-950). */
  --pluto-admin-canvas: ${v('zinc-950')};
  --pluto-admin-sidebar: ${v('zinc-950')};
  --pluto-admin-navbar: ${v('zinc-950')};
}

:root[data-pluto-admin] body {
  background-color: var(--pluto-admin-canvas);
}

:root[data-pluto-admin] body,
[data-pluto-admin-scope] {
  font-family: var(--font-sans);
  color: var(--ui-text);
}
`
fs.writeFileSync('app/assets/css/admin-theme.css', css)
console.log('written', css.split('\n').length, 'lines')
