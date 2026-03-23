<img width="335" height="105" alt="image" src="https://github.com/user-attachments/assets/1cf11470-ea54-416e-a940-7221fffef1e2" />

# Pluto CMS

A layer-based CMS powered by [Nuxt](https://nuxt.com/).

> [!WARNING]
> Pluto CMS is currently in **alpha** and at a very early stage. Expect breaking changes, incomplete features, and rough edges.
>
> Also note: **npm is still not supported** due to layer dependencies not being installed correctly. It is strongly recommended to use modern package managers like **pnpm** or **bun**.

Pluto CMS is designed to be modular, extensible, and developer-friendly. Instead of a monolithic system, it lets you compose your CMS using layers. You only install what you need.

## Features

* Layer-based architecture using Nuxt Layers
* Modern SSR + SPA hydration with Nuxt
* TypeScript-first developer experience
* Opt-in features instead of global plugin mutations
* Deployment-friendly (Edge and Serverless ready)
* Works as a full CMS or as a headless backend

## Requirements

* Node.js (22+) or Bun
* pnpm or Bun

> npm is not supported at this stage and may cause unexpected issues.

## Getting started

Create a new Pluto project using the CLI:

```bash
npm create pluto@latest

# or
pnpm create pluto@latest

# or
bun create pluto@latest
```

This will launch an interactive setup wizard where you can:

* Choose a database provider
* Configure database credentials (all stored locally on your project's .env)
* Select a starter template (blog, store, etc.)

Then:

```bash
cd your-project
npm install
npm run dev
```

## Architecture overview

Pluto CMS is built around **layers**, each responsible for a specific concern.

### Core layer (`@plutocms/pluto`)

The core layer provides the foundation for your CMS:

- `<PlutoRoot>`: Wraps your entire app (used in `app.vue`). Includes `NuxtLayout`, `NuxtLoadingIndicator`, and base styles.
- `<ColorModeButton>`: Light/dark mode toggle with zero configuration.
- Built-in auth and admin layouts
- `<PlutoNavbarAdmin>` and `<PlutoNavbarAdminActions>`
  Provide structure for injecting actions from other layers

### Backend layers

Backend layers handle data, authentication, and APIs.

Examples:

- `@plutocms/supabase`
  Provides Supabase integration (database, auth, users, etc.)
- Future possibilities:
  - Custom database providers (MySQL, MongoDB, etc.)
  - Other backend-as-a-service providers (Convex, Neon, Firebase, etc.)

### Feature layers

Feature layers add domain-specific functionality on top of backend layers.

Examples:

- `@plutocms/supabase-shop`
  Adds e-commerce features like:
  - Products
  - Media
  - Cart
- Other possible layers:
  - Blog
  - Portfolio
  - Analytics
  - Payments

> Feature layers depend on backend layers. For example, `@plutocms/supabase-shop` requires `@plutocms/supabase`.

## Using Pluto in existing Nuxt projects

Pluto is not limited to new projects.

You can extend an existing Nuxt app using layers:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: [
    '@plutocms/pluto'
    // Then add any backend or feature layers you need.
  ]
})
```

## Dashboard & headless usage

Although Pluto is built on Nuxt, it is not limited to Nuxt-only consumption.

- The admin dashboard can run as a standalone app on providers like Vercel or Netlify
- Data can be consumed via:
  - Composables (within Nuxt apps)
  - REST APIs exposed by layers

This allows you to:

- Use Pluto as a headless CMS
- Power web apps (any stack)
- Power mobile apps

## Why not just WordPress?

- Modern SSR and SPA hydration via Nuxt
- TypeScript-first experience
- Better control through Vue composables or REST APIs
- Deployment flexibility (Vercel, Cloudflare, Netlify, etc.)

If you're a Vue developer, you'll feel right at home.

## Roadmap ideas

- More official backend layers
- Rich ecosystem of feature layers
- Better developer tooling and DX improvements
- Community layers are very welcome! ❤️

## License

MIT (planned)

