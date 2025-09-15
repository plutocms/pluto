<img width="335" height="105" alt="image" src="https://github.com/user-attachments/assets/1cf11470-ea54-416e-a940-7221fffef1e2" />

# Pluto

> [!WARNING]
> 🚧 Work In Progress: Pluto is experimental. Breaking changes are expected. Not production ready yet.

Pluto is a modular, layer-driven Content Management System (CMS) built with Nuxt 3. A modern alternative to monolithic systems like WordPress. Extend functionality through Nuxt Layers: choose only what is needed (auth, storage, e-commerce, blog, database connectors, etc.).

## Highlights

- Nuxt 3 + Nuxt Layers architecture
- Headless-first: consume via API (_with typed routes!_), built-in composables (like `useAuth` or `useProduct`) or server-rendered pages
- Opt-in feature layers (Supabase, Blog, Shop, DB connectors, etc.)
- Core primitives: Content Types, Taxonomies, Custom Fields, Media, Permissions
- Deploy anywhere: Node, Edge, Serverless, Static (hybrid), Docker
- Developer-focused: composables, typed schemas, minimal core
- Dashboard is owned: fork + modify without forking an opaque binary

## Core Concepts

- Content Types: Define structured entities (e.g. Post, Product, Page)
- Fields: Primitive & custom (string, rich text, media, relation, JSON, computed)
- Taxonomies: Hierarchical or flat classification
- Media: Pluggable storage (e.g. Supabase, S3, local)
- Auth & Identity: Provided by optional layers (e.g. Supabase)
- Policies: Role / capability mapping (planned)
- Connectors: Abstract CRUD + queries across different databases (planned)

## Layer Examples (Planned / In Progress)

| Layer                     | Purpose                                         |
| ------------------------- | ----------------------------------------------- |
| core                      | Base CMS engine + schema registry               |
| supabase                  | Auth, file storage, row-level security hooks    |
| blog                      | Post model, categories, tags, markdown pipeline |
| shop                      | Product model, pricing, inventory abstraction   |
| mysql / postgres / sqlite | Database connectors                             |
| analytics                 | Basic event/log capture                         |
| search                    | Index + query adapters (e.g. Meilisearch)       |

> [!NOTE]
> Actual availability depends on roadmap progress.

For now, some layers are being developed (`/layers` directory) in this same repository, but will eventually be extracted into their own packages.

## Quick Start (Local)

```bash
# Clone to fully customize dashboard
git clone https://github.com/your-org/pluto

cd pluto

npm install   # or yarn / pnpm / bun

# Start dev
npm run dev # or yarn / pnpm / bun

# Access: http://localhost:3000
```

> [!NOTE]
> Optional layers may require environment variables; see ./env.example when added.

In your project's Nuxt config, extend the Pluto layer (relative path, github, npm, etc.):

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['../pluto'],
})
```

## Creating a Custom Layer

Check the official [Nuxt Layers documentation](https://nuxt.com/docs/4.x/getting-started/layers) for detailed instructions.

## Roadmap (Subject to Change)

Check [the roadmap here](https://github.com/ojvribeiro/pluto/issues/47).

## Contributing

- Open issues for design discussion before large PRs
- Keep layers isolated and opt-in
- Prefer typed contracts and explicit interfaces
- Add tests where possible (testing stack TBD)

## Philosophy

- Minimal core, everything else a layer
- Transparent, hackable dashboard (no locked UI bundle)
- Declarative schemas
- Runtime flexibility: choose infra, not dictated by core

## Why Not Just WordPress?

- Modern SSR + SPA hydration via Nuxt 3
- TypeScript-first developer experience
- Layer-based opt-in features instead of plugin global mutations
- Deployment portability (Edge / Serverless friendly)
- Headless usage is primary, not an afterthought
- If you're a Vue developer, you'll feel right at home.

## Security

Do not deploy to production yet. No security audit performed. Auth / ACL model incomplete.

## License

TBD (likely MIT). Not final.

## Status

Experimental. Expect refactors.

## Naming Note

"Pluto" is a working name; subject to rename if conflicts arise.
