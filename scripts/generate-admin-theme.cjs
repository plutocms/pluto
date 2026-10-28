// Generates app/assets/css/admin-theme.css from the Pluto UI tokens
// (app/assets/css/pluto-tokens.css) and the installed Tailwind palette (the
// status colors). Run from the repo root: node scripts/generate-admin-theme.cjs
// See the admin-theme skill for the palette choices and how they were
// validated.
const fs = require('node:fs')
const path = require('node:path')

const theme = fs.readFileSync(path.join(path.dirname(require.resolve('tailwindcss/package.json', { paths: [process.cwd()] })), 'theme.css'), 'utf8')
const tokens = fs.readFileSync('app/assets/css/pluto-tokens.css', 'utf8')

// sRGB hex to an OKLCH literal, so every value in the theme has one form.
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
function hexToOklch(hex) {
  const n = Number.parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((value) => toLinear(value / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.hypot(A, B)
  const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360
  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(2)})`
}

// A Pluto token (tholin, haze, heart, kuiper) or a Tailwind color, as an OKLCH literal.
function v(name) {
  const own = tokens.match(new RegExp(String.raw`--color-${name}: (#[0-9A-Fa-f]{6})`))
  if (own) {
    return hexToOklch(own[1])
  }
  return theme.match(new RegExp(String.raw`--color-${name}: (oklch\([^)]*\))`))[1]
}

// Tholin is a red-orange (hue 37). Tailwind red (hue 27) looks like it next
// to a primary button, so errors use rose (hue 17). Info is haze, the blue of
// the Pluto palette.
const roles = { primary: 'tholin', secondary: 'haze', success: 'green', info: 'haze', warning: 'amber', error: 'rose', neutral: 'kuiper' }
const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const scales = Object.entries(roles).map(([role, hue]) => `  /* ${role}: ${hue} */\n${shades.map((s) => `  --ui-color-${role}-${s}: ${v(`${hue}-${s}`)};`).join('\n')}`).join('\n\n')

// The semantic step of each role. Light: tholin 600 and haze 700 for 4.5:1 on
// white (the docs site uses the same steps), the status colors at 500. Dark:
// 400 for every role.
const lightSteps = { primary: 600, secondary: 700, success: 500, info: 500, warning: 500, error: 500 }
const semantic = (steps) => Object.entries(steps).map(([role, step]) => `  --ui-${role}: var(--ui-color-${role}-${step});`).join('\n')
const darkSteps = Object.fromEntries(Object.keys(lightSteps).map((role) => [role, 400]))

const n = (s) => `var(--ui-color-neutral-${s})`
const neutralLight = { 'text-dimmed': n(400), 'text-muted': n(500), 'text-toned': n(600), 'text': n(700), 'text-highlighted': n(900), 'text-inverted': '#fff', 'bg': '#fff', 'bg-muted': n(50), 'bg-elevated': n(100), 'bg-accented': n(200), 'bg-inverted': n(900), 'border': n(200), 'border-muted': n(200), 'border-accented': n(300), 'border-inverted': n(900) }
// Dark surfaces on the kuiper hue (273). Cards sit one step above the
// kuiper-900 canvas. The sidebar sits between the kuiper-950 navbar and the
// canvas. The chart palette passes the dataviz checks on the card surface.
const CARD_DARK = 'oklch(28% 0.042 273)'
const SIDEBAR_DARK = 'oklch(20.5% 0.040 273)'
const neutralDark = { 'text-dimmed': n(500), 'text-muted': n(400), 'text-toned': n(300), 'text': n(200), 'text-highlighted': '#fff', 'text-inverted': n(900), 'bg': CARD_DARK, 'bg-muted': n(800), 'bg-elevated': n(800), 'bg-accented': n(700), 'bg-inverted': '#fff', 'border': n(800), 'border-muted': n(700), 'border-accented': n(700), 'border-inverted': '#fff' }
const declare = (o) => Object.entries(o).map(([k, val]) => `  --ui-${k}: ${val};`).join('\n')

// The chart series, in a fixed order: tholin, haze, lime, violet, teal, amber.
// Validated with the dataviz palette checks (lightness band, chroma floor,
// colorblind and normal-vision separation of neighbors, 3:1 contrast) on white
// for light, and on the dark card surface for dark. Dark uses tholin 500, not
// the primary 400, which is too light for the dark band. Re-run the checks
// before you change a slot.
const chartLight = ['tholin-600', 'haze-600', 'lime-700', 'violet-500', 'teal-600', 'amber-600']
const chartDark = ['tholin-500', 'haze-500', 'lime-600', 'violet-500', 'teal-600', 'amber-600']
// Slot 1 reads the primary scale (tholin 600 in light, 500 in dark), so a
// brand primary (appConfig.pluto.brand) recolors it too.
function chart(list, primaryStep) {
  return [
    `  --ui-chart-1: var(--ui-color-primary-${primaryStep}); /* ${list[0]} */`,
    ...list.slice(1).map((c, i) => `  --ui-chart-${i + 2}: ${v(c)}; /* ${c} */`),
  ].join('\n')
}

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
 * \`[data-pluto-admin-dark]\` takes the dark tokens in both color modes. The
 * admin navbar is near black in light mode too, so its text and buttons need
 * the dark values.
 *
 * The colors are the Pluto UI tokens (pluto-tokens.css): primary tholin,
 * secondary and info haze, neutral kuiper. The status colors come from
 * Tailwind: green, amber, rose. The fonts are Public Sans for text and
 * Fredoka for page titles.
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
 * on the dark card surface (dark). This file is generated; keep the values in
 * sync with scripts/generate-admin-theme.cjs: run it from the repo root, never
 * edit this file by hand.
 */
:root[data-pluto-admin],
[data-pluto-admin-scope] {
${scales}

${semantic(lightSteps)}

${declare(neutralLight)}

${chart(chartLight, 600)}

  /* Surfaces. The navbar is near black in both modes. */
  --pluto-admin-canvas: #fff;
  --pluto-admin-sidebar: ${v('kuiper-50')};
  --pluto-admin-navbar: ${v('kuiper-950')};

  /* The Pluto fonts, as literals like the colors (see pluto-tokens.css). */
  --font-sans: "Public Sans", ui-sans-serif, system-ui, sans-serif;
  --pluto-admin-font-display: "Fredoka", "Public Sans", ui-sans-serif, system-ui, sans-serif;
}

:root[data-pluto-admin].dark,
.dark [data-pluto-admin-scope],
[data-pluto-admin-dark] {
${semantic(darkSteps)}

${declare(neutralDark)}

${chart(chartDark, 500)}

  /*
   * Four steps, darkest at the top: a near-black navbar, a darker sidebar,
   * a dim dark canvas (not pitch black), and cards (--ui-bg) one step above
   * the canvas.
   */
  --pluto-admin-navbar: ${v('kuiper-950')};
  --pluto-admin-sidebar: ${SIDEBAR_DARK};
  --pluto-admin-canvas: ${v('kuiper-900')};
}

:root[data-pluto-admin] body {
  background-color: var(--pluto-admin-canvas);
}

:root[data-pluto-admin] body,
[data-pluto-admin-scope] {
  font-family: var(--font-sans);
  color: var(--ui-text);
}

/* Page titles (h1 only) use the rounded face of the wordmark, as on the docs site. */
:root[data-pluto-admin] h1,
[data-pluto-admin-scope] h1 {
  font-family: var(--pluto-admin-font-display);
  letter-spacing: -0.01em;
}
`
fs.writeFileSync('app/assets/css/admin-theme.css', css)
console.log('written', css.split('\n').length, 'lines')
