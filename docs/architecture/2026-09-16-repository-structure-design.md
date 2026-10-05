# Repository Structure Reorganization Design

**Date:** 2026-09-16
**Status:** Approved in chat; awaiting written-spec review

## Goal

Reorganize the TripGenie repository so frontend and backend workspaces, tests, and documentation have consistent and predictable ownership. The change must preserve both applications' behavior and Git history while making future plans and specifications easier to locate.

## Target repository structure

```text
tourism-project/
├── frontend/
├── backend/
├── test/
│   ├── frontend/
│   └── backend/
├── docs/
│   ├── README.md
│   ├── architecture/
│   ├── frontend/
│   │   └── superpowers/
│   │       ├── plans/
│   │       └── specs/
│   └── backend/
│       └── superpowers/
│           ├── plans/
│           └── specs/
├── README.md
└── plan.md
```

## Workspace rename

- Rename the backend directory from `trip-genie/` to `backend/` with `git mv` so file history remains traceable.
- Keep the npm package name `trip-genie`; this change affects repository organization, not the application identity.
- Preserve all backend source, Prisma, Docker, and package configuration files.
- Update repository-relative paths in README files, documentation, scripts, and ignore rules.
- Keep paths internal to the backend workspace unchanged when they remain valid after the directory rename.

## Test organization

The root `test/` directory becomes the single test entrypoint, separated by application ownership.

```text
test/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── services/
│   └── setup.ts
└── backend/
    ├── app.e2e-spec.ts
    ├── auth.e2e-spec.ts
    └── jest-e2e.json
```

### Frontend tests

- Move every existing root frontend test into `test/frontend/`.
- Change `frontend/vitest.config.ts` to use `../test/frontend/setup.ts` and include only `../test/frontend/**/*.{test,spec}.{ts,tsx}`.
- Update commands and paths in frontend implementation plans.

### Backend tests

- Move the current `backend/test/` E2E suite into `test/backend/`.
- Update `backend/package.json` so `test:e2e` reads `../test/backend/jest-e2e.json`.
- Update E2E imports and the Jest module alias to resolve production code from `backend/src/`.
- Keep backend unit specifications in `backend/src/**/*.spec.ts`. They remain colocated with their production modules and continue to use the Jest configuration embedded in `backend/package.json`.
- Validate E2E discovery without requiring infrastructure. Run the full E2E suite only when PostgreSQL and Redis test services are available.

## Documentation organization

No domain-specific document should remain loose directly under `docs/`. The only file directly under `docs/` is the navigation index.

### Shared architecture

`docs/architecture/` contains documents that describe more than one workspace or define repository-wide conventions.

| Current path | Target path |
| --- | --- |
| `docs/ARCHITECTURE.md` | `docs/architecture/system-architecture.md` |
| `docs/Project-context.md` | `docs/architecture/project-context.md` |
| This design | `docs/architecture/2026-09-16-repository-structure-design.md` |

### Frontend documentation

All existing Superpowers plans and specs describe frontend map or planner work, so they move together.

| Current directory | Target directory |
| --- | --- |
| `docs/superpowers/plans/` | `docs/frontend/superpowers/plans/` |
| `docs/superpowers/specs/` | `docs/frontend/superpowers/specs/` |

`docs/frontend/README.md` documents frontend technology, local commands, test location, and where new frontend plans/specs belong.

### Backend documentation

| Current path | Target path |
| --- | --- |
| `docs/DB.md` | `docs/backend/database.md` |

`docs/backend/README.md` documents backend technology, local commands, Prisma generation, test location, and backend documentation conventions. Empty plan/spec directories receive small README files so their purpose remains visible in Git.

### Documentation index

`docs/README.md` links to:

- system architecture and project context;
- frontend overview, plans, and specs;
- backend overview, database documentation, plans, and specs.

All moved documents must have stale relative paths and cross-references updated.

## Migration rules

1. Use `git mv` for tracked paths to retain history.
2. Do not rename the backend npm package or change runtime APIs.
3. Do not move backend unit specs out of `backend/src/`.
4. Do not mix frontend and backend tests in the same subdirectory.
5. Do not leave compatibility copies at old paths; update all consumers to the canonical locations.
6. Keep `.env`, build output, dependencies, and local agent directories ignored.
7. Limit code changes to path/configuration corrections required by the restructure.

## Verification

After migration:

1. Search for stale repository-path references to `trip-genie/`, `docs/superpowers/`, and old root-test paths.
2. Confirm the working tree contains no duplicate files at old and new locations.
3. Run frontend tests, lint, and production build from `frontend/`.
4. Generate Prisma Client, then run backend unit tests and production build from `backend/`.
5. Run backend E2E test discovery using the relocated Jest configuration.
6. Confirm no real environment file or credential is tracked.
7. Review `git diff --summary` to verify Git recognizes moves where possible.

## Commit strategy

Use focused Conventional Commits:

1. `refactor(repo): rename backend workspace`
2. `refactor(test): separate frontend and backend tests`
3. `docs: organize frontend backend and architecture docs`

The commits are pushed to `develop` only after verification succeeds.
