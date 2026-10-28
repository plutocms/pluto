# Admin access for staff only

Status: done
Started: 2026-10-22
Projects: pluto (admin shell), supabase (auth driver), maybe the GitHub CMS driver
Branch / PR: fix/admin-staff-only, #196 (released as 0.17.1)

## Context

- Goal: a signed-in user with no capability (for example a shop customer) cannot open
  `/admin/**`. They go to the public site (or see a "no access" page), not the admin UI.
- Why: found on 2026-10-22 while testing the Data API grants. A new account with no role (sign-up
  is open) could open every admin page in the menu. The data stays safe (the API answers 403, and
  RLS hides rows: for example, settings Save gives `403 ... missing the "settings:manage"
permission`), but a customer should not see the admin at all.
- Facts:
  - Core owns the `/admin` route guard and the navbar (see the `admin-shell` skill). Today the
    guard checks only "signed in". The navbar on public pages already shows for staff only, so a
    staff check exists somewhere: reuse it.
  - "Staff" in the 007 RLS policy = a user who holds at least one capability
    (`my_capabilities()`). Use the same meaning in the guard.
  - The GitHub CMS driver gives every signed-in user capabilities (push access), so nothing
    changes there.
- Decisions (user, 2026-10-22):
  - Staff with any role can enter `/admin` (a user who holds at least one capability; an admin
    holds `*`). Each page and action keeps its own capability check. A user with no role cannot
    enter.
- Open questions: where a non-staff user goes (the site home, the account page, or a "no access"
  page); whether the check is a driver method or core reads the capabilities it already loads.

## Checklist

- [x] Read the admin-shell guard and the staff check for the public navbar.
- [x] Plan the change (UI guard only; the server already checks every request).
- [x] Implement (unit tests pass; the manual test with a staff user and a no-role user is for the user).
- [x] Release (pluto 0.17.1, #196).

## Log

- 2026-10-22: plan made from the grants test.
- 2026-10-22: implemented on `fix/admin-staff-only`: `isStaff`, `staffDecision`, `ensureLoaded`, the
  guard step, `/admin/no-access`, i18n, tests, docs. Lint, typecheck and tests pass. Not committed.
  A non-staff user goes to the core no-access page (decision of the user). Next: manual test by the
  user, then commit and release.
- 2026-10-25: released in pluto 0.17.1 (#196). The user checked it in a consumer app: a user with no
  role lands on `/admin/no-access`.
