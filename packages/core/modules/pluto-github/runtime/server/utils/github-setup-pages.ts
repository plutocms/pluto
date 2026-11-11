/**
 * The server-rendered pages of the GitHub App setup. They are plain HTML with
 * inline CSS, because they run before any sign-in works and outside the Nuxt
 * app. The functions are pure: the route passes a translate function `t`.
 * Every value goes through `escapeHtml`.
 */

export type SetupTranslate = (
  key: string,
  params?: Record<string, string | number>
) => string

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Escapes text for an HTML body or a quoted attribute. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char]!)
}

/** Escapes text for an HTML body, and makes `<code>` of the parts between backticks. */
export function escapeCodeText(value: string): string {
  return escapeHtml(value).replace(/`([^`]+)`/g, '<code>$1</code>')
}

// The look of the admin auth pages (the `auth` layout and PlutoAdminAuthCard): the colors of the
// admin theme (app/assets/css/admin-theme.css, OKLCH literals, light and dark), the canvas, a
// card with the logo, and the buttons, alerts and inline code of the admin. Public Sans when the
// browser has it, else the system font: the page loads no font file.
const STYLES = `
:root{color-scheme:light dark;--canvas:#fff;--card:#fff;--text:oklch(39.7% .05 273.48);--strong:oklch(24.1% .041 272.8);--muted:oklch(56% .049 273.45);--border:oklch(91% .016 269.97);--accented:oklch(83.3% .025 270.3);--elevated:oklch(95.5% .008 271.33);--primary:oklch(58.7% .184 36.16);--on-primary:#fff;--success:oklch(72.3% .219 149.579);--warn:oklch(76.9% .188 70.08);--warn-bg:oklch(76.9% .188 70.08/.1);--warn-ring:oklch(76.9% .188 70.08/.25)}
@media (prefers-color-scheme:dark){:root{--canvas:oklch(24.1% .041 272.8);--card:oklch(28% .042 273);--text:oklch(91% .016 269.97);--strong:#fff;--muted:oklch(68.5% .039 271.84);--border:oklch(31.2% .048 273.43);--accented:oklch(39.7% .05 273.48);--elevated:oklch(31.2% .048 273.43);--primary:oklch(72.8% .165 40.63);--on-primary:oklch(24.1% .041 272.8);--success:oklch(79.2% .209 151.711);--warn:oklch(82.8% .189 84.429);--warn-bg:oklch(82.8% .189 84.429/.1);--warn-ring:oklch(82.8% .189 84.429/.25)}}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--canvas);color:var(--text);font:14px/1.5 "Public Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:16px}
main{width:100%;max-width:40rem;display:flex;flex-direction:column;gap:16px;padding:24px 0}
.logo{display:block;height:32px;width:auto}
h1{color:var(--strong);font-size:1.875rem;line-height:1.2;font-weight:600;letter-spacing:-.02em;margin:0}
h2{color:var(--strong);font-size:1rem;font-weight:600;margin:0 0 4px}
p{margin:0 0 12px;color:var(--muted)}
.lead{margin:-8px 0 0}
.card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:24px}
.step{display:flex;gap:12px}
.num{flex:none;width:24px;height:24px;border-radius:50%;background:var(--elevated);color:var(--strong);font-weight:600;display:grid;place-items:center;font-size:.75rem;margin-top:-1px}
.step>div{min-width:0;flex:1}
.btn{display:inline-flex;align-items:center;gap:6px;border:0;box-shadow:inset 0 0 0 1px var(--accented);background:transparent;color:var(--text);padding:6px 10px;border-radius:6px;font:inherit;font-weight:500;cursor:pointer;text-decoration:none}
.btn:hover{background:var(--elevated)}
.btn.primary{background:var(--primary);box-shadow:none;color:var(--on-primary)}
.btn.primary:hover{background:color-mix(in oklch,var(--primary) 85%,var(--canvas))}
.btn:focus-visible,textarea:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
textarea{width:100%;min-height:11rem;resize:vertical;background:var(--canvas);color:var(--strong);border:0;box-shadow:inset 0 0 0 1px var(--accented);border-radius:6px;padding:8px 10px;font:.8rem/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;margin:4px 0 8px;white-space:pre;overflow:auto}
.note{background:var(--warn-bg);box-shadow:inset 0 0 0 1px var(--warn-ring);color:var(--warn);border-radius:8px;padding:12px 16px;margin:0 0 12px;font-size:.875rem}
.ok{color:var(--success)}
.ext{width:1em;height:1em;flex:none}
code{border:1px solid var(--accented);background:var(--elevated);color:var(--strong);padding:1px 5px;border-radius:4px;font:.875em ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
`

// The external icon of Nuxt UI (Lucide `arrow-up-right`), after a link that opens another site.
const EXTERNAL_ICON = `<svg class="ext" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>`

// The Pluto logo of the admin auth card: the black wordmark in light mode, the white one in dark
// mode (core serves both from public/img).
const LOGO = `<picture><source srcset="/img/pluto.png" media="(prefers-color-scheme: dark)"><img class="logo" src="/img/pluto.svg" alt="Pluto"></picture>`

function layout(lang: string | undefined, title: string, body: string): string {
  return `<!doctype html>
<html lang="${escapeHtml(lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
<main>
${LOGO}
${body}
</main>
</body>
</html>
`
}

export interface StartPageInput {
  t: SetupTranslate
  /** The language code of the page. */
  lang?: string
  /** The URL that the form posts to. */
  action: string
  /** The manifest as JSON text. */
  manifest: string
  appName: string
}

/**
 * The page that posts the manifest to GitHub. The form submits itself. The
 * button works without JavaScript.
 */
export function renderStartPage(input: StartPageInput): string {
  const { t } = input
  const body = `<h1>${escapeHtml(t('pluto.github.setup.page.start.title'))}</h1>
<p class="lead">${escapeHtml(t('pluto.github.setup.page.start.body', { name: input.appName }))}</p>
<form id="setup-form" class="card" method="post" action="${escapeHtml(input.action)}">
<input type="hidden" name="manifest" value="${escapeHtml(input.manifest)}">
<div class="row"><button class="btn primary" type="submit">${escapeHtml(t('pluto.github.setup.page.start.button'))}</button></div>
</form>
<script>document.getElementById('setup-form').submit()</script>`
  return layout(input.lang, t('pluto.github.setup.page.start.title'), body)
}

export interface ResultPageInput {
  t: SetupTranslate
  /** The language code of the page. */
  lang?: string
  appName: string
  /** The `KEY=value` lines to copy. */
  envBlock: string
  installUrl: string
  /** Development: the server wrote the values into `.env`. */
  envSaved: boolean
  /** Development: the server tried to write `.env` and failed. */
  envFailed: boolean
  /** Development: `.gitignore` does not ignore `.env`. */
  envNotIgnored: boolean
  dev: boolean
  /** The admin sign-in page. */
  signInUrl: string
}

/** The page that shows the env block, the install link and the next steps. */
export function renderResultPage(input: ResultPageInput): string {
  const { t } = input
  const saved = input.envSaved
    ? `<p class="ok">${escapeCodeText(t('pluto.github.setup.page.result.envSaved'))}</p>`
    : ''
  const failed = input.envFailed
    ? `<div class="note">${escapeCodeText(t('pluto.github.setup.page.result.envFailed'))}</div>`
    : ''
  const ignored = input.envNotIgnored
    ? `<div class="note">${escapeCodeText(t('pluto.github.setup.page.result.envNotIgnored'))}</div>`
    : ''
  const lastStep = input.dev
    ? t('pluto.github.setup.page.result.step3Dev')
    : t('pluto.github.setup.page.result.step3Prod')

  const body = `<h1>${escapeHtml(t('pluto.github.setup.page.result.title'))}</h1>
<p class="lead">${escapeHtml(t('pluto.github.setup.page.result.intro', { name: input.appName }))}</p>
<div class="note">${escapeHtml(t('pluto.github.setup.page.result.secretNote'))}</div>

<section class="card step">
<span class="num">1</span>
<div>
<h2>${escapeHtml(t('pluto.github.setup.page.result.step1'))}</h2>
<p>${escapeCodeText(input.dev ? t('pluto.github.setup.page.result.step1Dev') : t('pluto.github.setup.page.result.step1Prod'))}</p>
${saved}${failed}${ignored}
<textarea id="env" readonly spellcheck="false" rows="7" aria-label="${escapeHtml(t('pluto.github.setup.page.result.blockLabel'))}">${escapeHtml(input.envBlock)}</textarea>
<div class="row"><button class="btn" type="button" id="copy" data-copied="${escapeHtml(t('pluto.github.setup.page.result.copied'))}">${escapeHtml(t('pluto.github.setup.page.result.copy'))}</button></div>
</div>
</section>

<section class="card step">
<span class="num">2</span>
<div>
<h2>${escapeHtml(t('pluto.github.setup.page.result.step2'))}</h2>
<p>${escapeHtml(t('pluto.github.setup.page.result.step2Body'))}</p>
<div class="row"><a class="btn primary" href="${escapeHtml(input.installUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('pluto.github.setup.page.result.install'))}${EXTERNAL_ICON}</a></div>
</div>
</section>

<section class="card step">
<span class="num">3</span>
<div>
<h2>${escapeHtml(t('pluto.github.setup.page.result.step3'))}</h2>
<p>${escapeCodeText(lastStep)}</p>
<div class="row"><a class="btn" href="${escapeHtml(input.signInUrl)}">${escapeHtml(t('pluto.github.setup.page.result.signIn'))}</a></div>
</div>
</section>
<script>
(function(){var b=document.getElementById('copy'),t=document.getElementById('env');b.addEventListener('click',function(){
var done=function(){var o=b.textContent;b.textContent=b.getAttribute('data-copied');setTimeout(function(){b.textContent=o},2000)};
if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(t.value).then(done,function(){t.select();document.execCommand('copy');done()})}
else{t.select();document.execCommand('copy');done()}})})()
</script>`
  return layout(input.lang, t('pluto.github.setup.page.result.title'), body)
}

export interface ErrorPageInput {
  t: SetupTranslate
  /** The language code of the page. */
  lang?: string
  /** The message key under `pluto.github.setup.page.error`: `state` or `github`. */
  reason: 'state' | 'github'
  /** The start route, so the author can try again. */
  retryUrl: string
}

/** The page for a failed setup. It never shows a value from GitHub. */
export function renderErrorPage(input: ErrorPageInput): string {
  const { t } = input
  const body = `<h1>${escapeHtml(t('pluto.github.setup.page.error.title'))}</h1>
<div class="card">
<p>${escapeHtml(t(`pluto.github.setup.page.error.${input.reason}`))}</p>
<div class="row"><a class="btn primary" href="${escapeHtml(input.retryUrl)}">${escapeHtml(t('pluto.github.setup.page.error.retry'))}</a></div>
</div>`
  return layout(input.lang, t('pluto.github.setup.page.error.title'), body)
}
