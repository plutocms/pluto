# Git CMS: hybrid by default

## Context

The core Git CMS read posts from GitHub at run time and put `[skip ci]` on every commit. Two gaps:

- When GitHub fails (outage, rate limit, a bad App key), the public pages show an error, although
  the build bundles every post (the build snapshot of 0.49.1).
- No build ran after a save, so the snapshot (and a static output, such as GitHub Pages) stayed old.

Hybrid by default, like the docs layer: a save is live at once (run-time read), and a published save
starts a build that refreshes the bundled content. An anonymous read falls back to the bundled
content when GitHub fails.

## Checklist

- [x] `withSnapshotFallback`: with GitHub credentials, an anonymous read goes to GitHub; on an error
      (not a conflict) it reads the snapshot. A signed-in read never falls back. One warning per outage.
- [x] `createContentStore` uses it when credentials exist and the build bundled content.
- [x] `commit.skipDeploy` defaults to `false`: a draft save keeps `[skip ci]`, a published change deploys.
- [x] The post type sets `liveOnSave: true`.
- [x] Tests: the fallback, the defaults, the config reader.
- [x] Docs: git-cms skill, FEATURES.md, plutocms docs.
