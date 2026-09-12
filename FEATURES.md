# Features

This file lists every implemented feature of this project. Each entry links to a skill file
with full detail, so this file stays short.

See the workspace-level `CLAUDE.md` (one directory up) for the delegation, writing, and git
policies shared by every project here.

- Extension registry: a typed, ordered, reactive registry that lets a layer plug its admin-UI
  pieces (navbar, sidebar nav, pages, dashboard widgets, settings panels and driver) into core
  with one function call. @.claude/skills/extension-registry/SKILL.md
- Permissions: a typed capability registry and a `usePlutoPermissions()` composable that let a
  layer declare capabilities and check what the current user holds, backed by a registered
  permissions driver. @.claude/skills/permissions/SKILL.md
