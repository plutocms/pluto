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

const STYLES = `
:root{color-scheme:light dark;--bg:#f6f7f9;--card:#fff;--text:#14171a;--muted:#5b6670;--border:#dfe3e8;--accent:#16a34a;--accent-text:#fff;--code:#f0f2f5;--warn:#92400e;--warn-bg:#fef3c7}
@media (prefers-color-scheme:dark){:root{--bg:#0e1013;--card:#171a1f;--text:#eceff2;--muted:#9aa5b1;--border:#2a2f36;--accent:#22c55e;--accent-text:#04210f;--code:#0e1013;--warn:#fcd34d;--warn-bg:#3b2a08}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:32px 16px}
main{max-width:40rem;margin:0 auto}
h1{font-size:1.6rem;line-height:1.25;margin:0 0 .5rem}
h2{font-size:1.05rem;margin:0 0 .35rem}
p{margin:.25rem 0 .75rem;color:var(--muted)}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin:16px 0}
.step{display:flex;gap:12px}
.num{flex:none;width:28px;height:28px;border-radius:50%;background:var(--accent);color:var(--accent-text);font-weight:700;display:grid;place-items:center;font-size:.9rem}
.step>div{min-width:0;flex:1}
.btn{display:inline-block;border:1px solid var(--border);background:var(--card);color:var(--text);padding:9px 16px;border-radius:8px;font:inherit;font-weight:600;cursor:pointer;text-decoration:none}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-text)}
.btn:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
textarea{width:100%;min-height:11rem;resize:vertical;background:var(--code);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:12px;font:.8rem/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;margin:8px 0;white-space:pre;overflow:auto}
.note{background:var(--warn-bg);color:var(--warn);border-radius:8px;padding:10px 12px;margin:12px 0;font-size:.92rem}
.ok{color:var(--accent)}
code{background:var(--code);padding:1px 5px;border-radius:4px;font-size:.9em}
`

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
<p>${escapeHtml(t('pluto.github.setup.page.start.body', { name: input.appName }))}</p>
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
    ? `<p class="ok">${escapeHtml(t('pluto.github.setup.page.result.envSaved'))}</p>`
    : ''
  const failed = input.envFailed
    ? `<div class="note">${escapeHtml(t('pluto.github.setup.page.result.envFailed'))}</div>`
    : ''
  const ignored = input.envNotIgnored
    ? `<div class="note">${escapeHtml(t('pluto.github.setup.page.result.envNotIgnored'))}</div>`
    : ''
  const lastStep = input.dev
    ? t('pluto.github.setup.page.result.step3Dev')
    : t('pluto.github.setup.page.result.step3Prod')

  const body = `<h1>${escapeHtml(t('pluto.github.setup.page.result.title'))}</h1>
<p>${escapeHtml(t('pluto.github.setup.page.result.intro', { name: input.appName }))}</p>
<div class="note">${escapeHtml(t('pluto.github.setup.page.result.secretNote'))}</div>

<section class="card step">
<span class="num">1</span>
<div>
<h2>${escapeHtml(t('pluto.github.setup.page.result.step1'))}</h2>
<p>${escapeHtml(input.dev ? t('pluto.github.setup.page.result.step1Dev') : t('pluto.github.setup.page.result.step1Prod'))}</p>
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
<div class="row"><a class="btn primary" href="${escapeHtml(input.installUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('pluto.github.setup.page.result.install'))}</a></div>
</div>
</section>

<section class="card step">
<span class="num">3</span>
<div>
<h2>${escapeHtml(t('pluto.github.setup.page.result.step3'))}</h2>
<p>${escapeHtml(lastStep)}</p>
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
