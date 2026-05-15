# Auto-build conflict — Knowspace, 2026-05-14

Writeup of what happened when the Broadchurch auto-build agent and an
interactive Cursor session both built the Knowspace MVP from the same PRD,
in parallel, in the same git repo, on the same day. Sharing with engineering
so we can decide whether to keep this from happening on future tenants.

## TL;DR

Two agents independently scaffolded the Knowspace MVP from `DESIGN.md` within
~2 minutes of each other. The auto-build agent pushed first and chose KV
(Upstash Redis) as the system of record "for now, migrate to Postgres later."
The interactive agent built on Postgres as the PRD literally specifies, hit
a non-fast-forward push rejection, surfaced the conflict to the user, and —
on the user's explicit instruction — force-pushed the Postgres build over
the auto-build with `git push origin main --force-with-lease`.

The auto-build's commit is preserved in the object database as `ffa61aa` but
is no longer reachable from any branch.

## Verifiable timeline

All timestamps Eastern. Reconstructed from `git log --all` and `git reflog`.

| Time (EDT)   | Actor                           | Commit        | Action                                        |
| ------------ | ------------------------------- | ------------- | --------------------------------------------- |
| 17:25:09     | `cmac` (user)                   | `4ed0d3e`     | Initial commit (empty repo bootstrap)         |
| 17:25:12     | `broadchurch-portal[bot]`       | `de2102a`     | Configure tenant (writes `broadchurch.yaml`)  |
| 17:25:13     | `broadchurch-portal[bot]`       | `511a562`     | Add project design (writes `DESIGN.md`)       |
| 17:25:47     | `aether-setup[bot]`             | `4937b63`     | Initialize project: Nuxt 3 + Vuetify scaffold |
| 17:30:30     | `lovelace-bongo` (Cursor)       | —             | Local clone of repo                           |
| **17:43:12** | **`Cursor Agent` (auto-build)** | **`ffa61aa`** | **Push KV-backed MVP (40+ files)**            |
| 17:45:15     | `lovelace-bongo` (Cursor)       | `631ee0a`     | Local commit: Postgres-backed MVP             |
| 17:45–17:50  | `lovelace-bongo` (Cursor)       | —             | `git push` rejected (non-fast-forward)        |
| 17:50–17:55  | user                            | —             | Reviewed diff, chose Postgres build           |
| 17:55–18:00  | `lovelace-bongo` (Cursor)       | `631ee0a`     | `git push --force-with-lease origin main`     |

The auto-build had a ~13-minute head start (clone 17:30 vs auto-build push
17:43). The interactive session was about 2 minutes behind on the push.

## How I discovered the conflict

1. Ran `git push origin main` after committing the Postgres MVP locally.
2. Got:
    ```
    ! [rejected]        main -> main (non-fast-forward)
    error: failed to push some refs to 'https://github.com/Lovelace-AI/knowspace-yottagraph.git'
    hint: Updates were rejected because the tip of your current branch is behind
    ```
3. Ran `git fetch` then `git log origin/main --oneline` and saw a commit by
   `Cursor Agent <cursoragent@cursor.com>` titled
   `[Agent commit] Build Knowspace workspace MVP`.
4. `git diff origin/main main --stat` showed the auto-build had touched the
   same surfaces (pages/, server/api/, composables/) but with different
   filenames, route shapes, and a fundamentally different storage layer
   (KV vs. Postgres).

## What the two builds actually were

Both honored the PRD's UX intent — workspace shell, page tree, collections,
sources, entities, search, AI assistant — and both used Nuxt 3 + Vuetify 3,
not the Next.js the brief suggested (since the project is provisioned as an
Aether tenant).

The fundamental divergence:

### Storage layer

| Aspect                    | Auto-build (`ffa61aa`)                                                                             | Interactive build (`631ee0a` onward)                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **System of record**      | Upstash Redis (KV)                                                                                 | Neon Postgres                                                                                          |
| **PRD alignment**         | Section 10 schema mirrored in TS types, not in storage                                             | Section 10 schema executed against Postgres directly                                                   |
| **Stated rationale**      | "KV is always available, future Postgres migration is mechanical" (from auto-build commit message) | PRD says Postgres; provisioning already created a Neon store                                           |
| **Server util**           | `server/utils/workspace.ts` — typed KV CRUD over Redis hashes                                      | `server/utils/{neon,schema,workspace,notionImport}.ts` — SQL templates over `@neondatabase/serverless` |
| **Search backend**        | In-memory scan of KV blobs in `/api/workspace/search.post.ts`                                      | Postgres FTS via `to_tsvector` and `plainto_tsquery`                                                   |
| **Entity enrichment**     | `entityExtractor.ts` regex placeholder                                                             | Deferred to Phase 5 (uses the Lovelace Elemental MCP/query server)                                     |
| **Idempotency on import** | Each upload creates new records                                                                    | Stable `pg_n_` / `col_n_` / `rec_n_` IDs hashed from Notion source paths; `ON CONFLICT DO UPDATE`      |

### Route shape

| Concern       | Auto-build                                       | Interactive build                                                      |
| ------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| API namespace | `/api/workspace/{pages,collections,...}`         | `/api/{pages,collections,...}` (flat)                                  |
| Pages routes  | `pages/create.post`, `pages/list.get`            | RESTful `pages/index.{get,post}`, `[id].{get,patch,delete}`            |
| Auth gate     | `requireAuth + getRedis()` per route             | `getOrCreateDefaultWorkspace(event)` per route, reads user from cookie |
| Composables   | `composables/useKnowspace.ts` (wraps every call) | `composables/useWorkspaceNav.ts` (page tree + favorites only)          |
| Sidebar       | `components/AppSidebar.vue`                      | `components/WorkspaceSidebar.vue`                                      |

### What was in the auto-build that we didn't keep

- `pages/assistant.vue` — grounded Q&A page (was a chunk-and-score in
  Vue; interactive build moved that idea behind `/api/ask` as a server
  endpoint to be done properly in Phase 6).
- `pages/pages/index.vue` — separate `/pages` tree view (interactive
  build folds the tree into the sidebar instead).
- `/api/workspace/imports/notion-upload.post.ts` — accepted raw zips
  server-side. Interactive build moved Notion parsing client-side into
  `scripts/notion-prep.ts` to dodge Vercel's 4.5 MB serverless body
  limit (the user's actual export is 789 MB).

## Evidence preserved

The auto-build commit is still in the git object database. Anyone with the
repo can inspect it:

```bash
git show ffa61aa --stat
git show ffa61aa:DESIGN.md      # auto-build's edits to DESIGN.md
git show ffa61aa:server/utils/workspace.ts   # KV-backed CRUD
git show ffa61aa:pages/assistant.vue          # the grounded-Q&A page
```

It's not reachable from any branch, so it won't appear in normal `git log`
without `--all`. It will eventually be garbage-collected (default 30 days
for unreachable commits via `gc.pruneExpire`). If we want to keep it
forever, tag it:

```bash
git tag autobuild-knowspace-2026-05-14 ffa61aa
git push origin autobuild-knowspace-2026-05-14
```

## Why this happened

The Broadchurch portal kicks off an auto-build agent on tenant
provisioning. Looking at the timeline, the auto-build started no later than
17:25:47 (the `aether-setup` commit, which it depends on) and pushed at
17:43:12 — so the auto-build ran for ~18 minutes unattended.

Meanwhile, the interactive Cursor session was opened by the user
immediately after provisioning, the user ran `/build_my_app`, and the
Cursor agent did its own scaffolding in parallel. Neither agent had any
signal that the other one was working. Cursor's agent had no notion of a
pending auto-build, and the auto-build had no notion of a parallel
interactive session — they both committed against `main` directly because
the workspace convention is to push to `main`, no feature branches.

The 13-minute head start the auto-build had didn't help: the interactive
session was already at "ready to push" 2 minutes after the auto-build's
push landed.

## Recommendations for engineering

In rough order of effort vs. impact:

1. **Have the auto-build push to a non-default branch** like
   `autobuild/initial` and open a PR. Then any interactive session sees
   a real signal that an auto-build exists, instead of finding out at
   push time.
2. **Have the auto-build wait for a signal** — e.g. a "user has opened an
   interactive session in the last N minutes" probe via the portal —
   before scaffolding. If a user is actively building, defer.
3. **Pin the storage decision in `DESIGN.md` more aggressively** — the PRD
   does say "Postgres as system of record" but both agents apparently
   weighed that against the convenience of KV and one of them chose to
   downgrade. A `## Non-negotiable decisions` block at the top of
   `DESIGN.md` that lists "Postgres is the system of record" would make
   it harder to drift.
4. **Make the interactive agent fetch before scaffolding.** A
   `git fetch origin && git log --oneline ..origin/main` after opening
   the workspace would have surfaced the auto-build before any local
   work was done, and the user could have decided which to keep before
   investing time in either.
5. **Have the portal include a "scaffold completed" notification** so the
   user knows an auto-build ran. The first I knew about it was at push
   time.

## What got force-pushed

The interactive build kept these characteristics, all of which were chosen
to honor the PRD literally:

- Postgres (Neon) as the system of record, with `ensureSchema()` creating
  every table from PRD section 10.
- Idempotent Notion import keyed by source-path SHA-1 — re-running the
  import updates instead of duplicating.
- Notion import done as a local CLI (`npm run notion-prep`) that emits a
  small JSON bundle, which is then either uploaded via the browser or
  posted via the CLI with `X-Api-Key`. This works around Vercel's 4.5 MB
  serverless body limit (the actual export is 789 MB).
- No KV write path on the data plane. KV is reserved for user preferences
  via `usePrefsStore()`, per the Aether convention.

End result is at `c160b9e` (current `main` tip) and deployed at
[knowspace.yottagraph.app](https://knowspace.yottagraph.app). 436 pages,
17 collections, 2,063 records imported from the user's Notion export.
