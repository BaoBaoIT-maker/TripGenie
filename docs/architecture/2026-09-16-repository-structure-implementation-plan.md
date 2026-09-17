# Repository Structure Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the backend workspace and separate tests and documentation by frontend, backend, and shared architecture ownership.

**Architecture:** Preserve application boundaries and Git history with tracked moves. Root `test/` owns `frontend/` and `backend/` subtrees; root `docs/` owns an index plus architecture, frontend, and backend subtrees.

**Tech Stack:** Git, Next.js 16, Vitest 5, NestJS 11, Jest 30, Prisma 7, Markdown.

**Spec:** `docs/architecture/2026-09-16-repository-structure-design.md`

## Global Constraints

- Keep the backend npm package name `trip-genie`.
- Keep backend unit specs colocated in `backend/src/**/*.spec.ts`.
- Move only backend E2E tests into `test/backend/`.
- Preserve runtime behavior and public APIs.
- Use tracked moves wherever possible.
- Push to `develop` only after all available verification passes.

---

### Task 1: Rename the backend workspace

**Files:**
- Move: `trip-genie/` to `backend/`
- Modify: `.gitignore`
- Modify: `README.md`

- [ ] **Step 1: Verify the target layout does not exist**

Run a PowerShell assertion that `backend/` is absent and `trip-genie/` exists. Expected: the desired-layout assertion fails before the move.

- [ ] **Step 2: Move the tracked workspace**

Run `git mv trip-genie backend`.

- [ ] **Step 3: Update repository paths**

Replace directory references in `.gitignore`, root README, and current shared documentation without changing the npm package name.

- [ ] **Step 4: Verify backend commands from the new path**

Run `npx prisma generate`, `npm test -- --runInBand`, and `npm run build` from `backend/`.

- [ ] **Step 5: Commit**

Commit as `refactor(repo): rename backend workspace`.

### Task 2: Separate frontend and backend tests

**Files:**
- Move: existing root frontend tests to `test/frontend/`
- Move: `backend/test/` to `test/backend/`
- Modify: `frontend/vitest.config.ts`
- Modify: `backend/package.json`
- Modify: `test/backend/jest-e2e.json`
- Modify: backend E2E imports

- [ ] **Step 1: Verify new test paths are absent**

Assert that `test/frontend/` and `test/backend/` do not yet exist. Expected: desired layout is missing.

- [ ] **Step 2: Move frontend and backend tests**

Create the two ownership directories, move root frontend test groups into `test/frontend/`, and move backend E2E files into `test/backend/`.

- [ ] **Step 3: Observe configuration failures**

Run frontend test discovery and backend E2E discovery before updating configuration. Expected: old paths fail or discover no relocated tests.

- [ ] **Step 4: Update test configuration and imports**

Point Vitest at `../test/frontend/`. Point the backend E2E script at `../test/backend/jest-e2e.json`, set aliases to `backend/src/`, and update relative E2E imports.

- [ ] **Step 5: Verify tests**

Run the full frontend suite, backend unit suite, and backend E2E `--listTests` discovery. Run E2E execution only if its PostgreSQL and Redis dependencies are available.

- [ ] **Step 6: Commit**

Commit as `refactor(test): separate frontend and backend tests`.

### Task 3: Organize documentation by ownership

**Files:**
- Create: `docs/README.md`
- Create: `docs/frontend/README.md`
- Create: `docs/backend/README.md`
- Move: shared documents into `docs/architecture/`
- Move: frontend Superpowers documents into `docs/frontend/superpowers/`
- Move: database documentation into `docs/backend/`
- Create: backend Superpowers plan/spec directory guidance

- [ ] **Step 1: Move documentation**

Use `git mv` according to the mapping in the design spec.

- [ ] **Step 2: Create documentation indexes**

Add root, frontend, backend, backend-plan, and backend-spec README files with canonical links and ownership rules.

- [ ] **Step 3: Update stale references**

Replace old `docs/superpowers/`, `trip-genie/`, and root frontend-test paths in all maintained documentation.

- [ ] **Step 4: Verify documentation layout**

Search for stale directory references and confirm no domain document remains loose under `docs/`.

- [ ] **Step 5: Commit**

Commit as `docs: organize frontend backend and architecture docs`.

### Task 4: Final verification

**Files:** No intended source changes.

- [ ] **Step 1: Verify frontend**

Run `npm test`, `npm run lint`, and `npm run build` from `frontend/`.

- [ ] **Step 2: Verify backend**

Run `npx prisma generate`, `npm test -- --runInBand`, and `npm run build` from `backend/`.

- [ ] **Step 3: Verify repository hygiene**

Confirm a clean working tree, no conflict markers, no tracked real environment files, no leaked credentials, and no stale directory references.

- [ ] **Step 4: Review commit history**

Confirm the three implementation commits are focused and `develop` remains a fast-forward of `origin/develop` before any push.
