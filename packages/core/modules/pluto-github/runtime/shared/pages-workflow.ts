export const PAGES_WORKFLOW_PATH = '.github/workflows/pluto-pages.yml'

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

const LOCK_FILES: [string, PackageManager][] = [
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
]

export function detectPackageManager(files: readonly string[]): PackageManager {
  const names = new Set(files)
  return LOCK_FILES.find(([file]) => names.has(file))?.[1] ?? 'npm'
}

function actionsExpression(expression: string): string {
  return ['$', '{{ ', expression, ' }}'].join('')
}

function buildSteps(manager: PackageManager): {
  setup: string[]
  build: string
} {
  const node = [
    '      - uses: actions/setup-node@v4',
    '        with:',
    '          node-version: 22',
  ]
  switch (manager) {
    case 'bun':
      return {
        setup: [
          '      - uses: oven-sh/setup-bun@v2',
          '      - run: bun install --frozen-lockfile',
        ],
        build: 'bunx nuxt generate --preset github_pages',
      }
    case 'pnpm':
      return {
        setup: [
          '      - uses: pnpm/action-setup@v4',
          ...node,
          '          cache: pnpm',
          '      - run: pnpm install --frozen-lockfile',
        ],
        build: 'pnpm exec nuxt generate --preset github_pages',
      }
    case 'yarn':
      return {
        setup: [
          ...node,
          '          cache: yarn',
          '      - run: yarn install --frozen-lockfile',
        ],
        build: 'yarn nuxt generate --preset github_pages',
      }
    default:
      return {
        setup: [...node, '          cache: npm', '      - run: npm ci'],
        build: 'npx nuxt generate --preset github_pages',
      }
  }
}

export const PUBLISH_SCHEDULED_SCRIPT = [
  "import { appendFileSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'",
  "import { join } from 'node:path'",
  "const dir = process.env.PLUTO_CONTENT_DIR || 'content'",
  'const now = Date.now()',
  'let published = 0',
  'function publish(path) {',
  "  const text = readFileSync(path, 'utf8')",
  '  const match = /^---\\r?\\n([\\s\\S]*?)\\r?\\n---/.exec(text)',
  '  if (!match) return',
  '  const front = match[1]',
  '  if (!/^status: ["\']?scheduled["\']?\\s*$/m.test(front)) return',
  '  const at = /^publishedAt: ["\']?([^"\'\\s]+)["\']?\\s*$/m.exec(front)',
  '  const time = at ? Date.parse(at[1]) : Number.NaN',
  '  if (Number.isNaN(time) || time > now) return',
  "  const next = front.replace(/^status: .*$/m, 'status: published')",
  '  writeFileSync(path, text.replace(front, next))',
  '  published += 1',
  '}',
  'function walk(folder) {',
  '  for (const entry of readdirSync(folder, { withFileTypes: true })) {',
  "    if (entry.name.startsWith('.')) continue",
  '    const path = join(folder, entry.name)',
  '    if (entry.isDirectory()) walk(path)',
  "    else if (entry.name.endsWith('.md')) publish(path)",
  '  }',
  '}',
  'try {',
  '  walk(dir)',
  '} catch (error) {',
  "  if (error.code !== 'ENOENT') throw error",
  '}',
  "if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'published=' + published + '\\n')",
  "console.log('Published ' + published + ' scheduled item(s).')",
]

export function renderPagesWorkflow(options: {
  branch: string
  packageManager: PackageManager
  dir?: string
}): string {
  const { setup, build } = buildSteps(options.packageManager)
  const expression = actionsExpression
  return [
    '# Builds the site as static files and deploys it to GitHub Pages, on each push.',
    '# Pluto wrote this file. The build reads the Markdown of the repo: it needs no secret.',
    'name: Deploy to GitHub Pages',
    '',
    'on:',
    '  push:',
    `    branches: [${JSON.stringify(options.branch)}]`,
    '  workflow_dispatch:',
    '  # Scheduled posts: every hour, publish the posts whose time has come, then build. GitHub can',
    '  # start a scheduled run some minutes late. Change the cron for another rhythm.',
    '  schedule:',
    "    - cron: '17 * * * *'",
    '',
    'permissions:',
    '  contents: read',
    '  pages: write',
    '  id-token: write',
    '',
    'concurrency:',
    '  group: pages',
    '  cancel-in-progress: true',
    '',
    'jobs:',
    '  publish:',
    "    if: github.event_name == 'schedule'",
    '    runs-on: ubuntu-latest',
    '    permissions:',
    '      contents: write',
    '    outputs:',
    `      published: ${expression('steps.publish.outputs.published')}`,
    '    steps:',
    '      - uses: actions/checkout@v4',
    '        with:',
    `          ref: ${JSON.stringify(options.branch)}`,
    '      - id: publish',
    '        env:',
    `          PLUTO_CONTENT_DIR: ${JSON.stringify(options.dir ?? 'content')}`,
    '        run: |',
    "          node --input-type=module <<'PLUTO'",
    ...PUBLISH_SCHEDULED_SCRIPT.map((line) => `          ${line}`),
    '          PLUTO',
    "      - if: steps.publish.outputs.published != '0'",
    '        run: |',
    '          git config user.name "github-actions[bot]"',
    '          git config user.email "41898283+github-actions[bot]@users.noreply.github.com"',
    `          git commit -am "content: publish ${expression('steps.publish.outputs.published')} scheduled"`,
    '          git push',
    '',
    '  build:',
    '    needs: publish',
    '    # On a push: always. On the schedule: only when the publish job published a post.',
    `    if: ${expression("always() && needs.publish.result != 'failure' && (github.event_name != 'schedule' || needs.publish.outputs.published != '0')")}`,
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '        with:',
    `          ref: ${JSON.stringify(options.branch)}`,
    '      - id: pages',
    '        uses: actions/configure-pages@v5',
    ...setup,
    `      - run: ${build}`,
    '        env:',
    '          # A project site lives under /<repo>. A user site or a custom domain has no path.',
    `          PLUTO_BASE_URL: ${actionsExpression('steps.pages.outputs.base_path')}`,
    '          # The address of the site, for the absolute URLs of the pages.',
    `          NUXT_PUBLIC_WEBSITE_URL: ${actionsExpression('steps.pages.outputs.base_url')}`,
    '      - uses: actions/upload-pages-artifact@v3',
    '        with:',
    '          path: .output/public',
    '',
    '  deploy:',
    '    needs: build',
    '    runs-on: ubuntu-latest',
    '    environment:',
    '      name: github-pages',
    `      url: ${actionsExpression('steps.deployment.outputs.page_url')}`,
    '    steps:',
    '      - id: deployment',
    '        uses: actions/deploy-pages@v4',
    '',
  ].join('\n')
}

export function defaultPagesUrl(repo: string): string {
  const [owner = '', name = ''] = repo.split('/')
  const host = `${owner.toLowerCase()}.github.io`
  return name.toLowerCase() === host
    ? `https://${host}/`
    : `https://${host}/${name}/`
}
