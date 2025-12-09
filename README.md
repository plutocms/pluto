<img width="335" height="105" alt="image" src="https://github.com/user-attachments/assets/1cf11470-ea54-416e-a940-7221fffef1e2" />

# Pluto

> [!WARNING]
> 🚧 Work In Progress: Pluto is experimental. Breaking changes are expected. Not production ready yet.

Pluto is a modular, layer-driven Content Management System (CMS) built with Nuxt. A modern alternative to monolithic systems like WordPress. Extend functionality through Nuxt Layers: choose only what is needed (auth, storage, e-commerce, blog, database connectors, etc.).

## Highlights

- Nuxt + Nuxt Layers architecture
- Headless-first: consume via API (_with typed routes!_), built-in composables (like `useAuth` or `useProduct`) or server-rendered pages
- Opt-in feature layers (Supabase, Blog, Shop, DB connectors, etc.)
- Core primitives: Content Types, Taxonomies, Custom Fields, Media, Permissions
- Deploy anywhere: Node, Edge, Serverless, Static (hybrid), Docker
- Developer-focused: composables, typed schemas, minimal core
- Dashboard is owned: fork + modify without forking an opaque binary

## Getting Started

First, install the Pluto layer in your Nuxt project. You can either use the repository or install it directly via npm/yarn/pnpm/bun.

```bash
npm install @plutocms/pluto
```

Also, install `typescript` as a dev dependency if you haven't already. This is required for Nuxt Layers to function properly.

```bash
npm install --save-dev typescript
```

Then, extend your Nuxt configuration to include the Pluto layer, setting the install option to true, so Pluto's dependencies are installed automatically.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: [
    ['@plutocms/pluto', { install: true }],

    // Then, add any additional layers you want to use here
    ['@plutocms/supabase', { install: true }],
    ['@plutocms/blog', { install: true }],
    ['@plutocms/shop', { install: true }],
  ],
})
```

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

> [!NOTE]
> Optional layers may require environment variables; see ./env.example when added.

## Roadmap (Subject to Change)

Check [the roadmap here](https://github.com/ojvribeiro/pluto/issues/47).

## Contributing

- Open issues for design discussion before large PRs
- Keep layers isolated and opt-in
- Prefer typed contracts and explicit interfaces
- Add tests where possible (testing stack TBD)

## Philosophy

- Minimal core, everything is a layer
- Transparent, hackable dashboard (no locked UI bundle)
- Declarative schemas
- Runtime flexibility: choose infra, not dictated by core

## Why Not Just WordPress?

- Modern SSR + SPA hydration via Nuxt
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
