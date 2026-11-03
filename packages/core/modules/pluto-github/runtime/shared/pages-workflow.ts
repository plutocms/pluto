/** The path of the GitHub Pages workflow that the Deploy page writes. */
export const PAGES_WORKFLOW_PATH = '.github/workflows/pluto-pages.yml'

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

/** The lock file of each package manager, in the order the check reads them. */
const LOCK_FILES: [string, PackageManager][] = [
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
]

/** The package manager of a project, from the files at its root. Default npm. */
export function detectPackageManager(files: readonly string[]): PackageManager {
  const names = new Set(files)
  return LOCK_FILES.find(([file]) => names.has(file))?.[1] ?? 'npm'
}

/** A GitHub Actions expression: `${{ <expression> }}` in the workflow. */
function actionsExpression(expression: string): string {
  return ['$', '{{ ', expression, ' }}'].join('')
}

/**
 * The setup and install steps of each package manager, and the build command, as YAML lines. The
 * command is `nuxt generate`, not `nuxt build`: Nuxt Icon sees a static site only through
 * `generate`. Then it reads icons from the Iconify API in the browser, instead of the
 * `/api/_nuxt_icon` route that a static site does not have.
 */
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

/**
 * The GitHub Actions workflow that builds the site as static files and deploys it to GitHub
 * Pages, on each push to the content branch. The build reads the Markdown of the checkout, so it
 * needs no secret. `PLUTO_BASE_URL` gets the sub path of a project site (`/<repo>`), or nothing
 * for a user site or a custom domain.
 */
export function renderPagesWorkflow(options: {
  branch: string
  packageManager: PackageManager
}): string {
  const { setup, build } = buildSteps(options.packageManager)
  return [
    '# Builds the site as static files and deploys it to GitHub Pages, on each push.',
    '# Pluto wrote this file. The build reads the Markdown of the repo: it needs no secret.',
    'name: Deploy to GitHub Pages',
    '',
    'on:',
    '  push:',
    `    branches: [${JSON.stringify(options.branch)}]`,
    '  workflow_dispatch:',
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
    '  build:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - id: pages',
    '        uses: actions/configure-pages@v5',
    ...setup,
    `      - run: ${build}`,
    '        env:',
    '          # A project site lives under /<repo>. A user site or a custom domain has no path.',
    `          PLUTO_BASE_URL: ${actionsExpression('steps.pages.outputs.base_path')}`,
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

/** The default address of a GitHub Pages site: `https://<owner>.github.io/<repo>/`. */
export function defaultPagesUrl(repo: string): string {
  const [owner = '', name = ''] = repo.split('/')
  const host = `${owner.toLowerCase()}.github.io`
  return name.toLowerCase() === host
    ? `https://${host}/`
    : `https://${host}/${name}/`
}
