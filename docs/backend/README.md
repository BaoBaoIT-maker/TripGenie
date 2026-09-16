# Backend Documentation

This directory owns documentation for the NestJS application in `backend/`.

## Locations

- `database.md`: database schema and persistence design.
- `superpowers/plans/`: step-by-step backend implementation plans.
- `superpowers/specs/`: reviewed backend feature and API designs.
- `../../test/backend/`: backend E2E tests and their Jest configuration.
- `../../backend/src/**/*.spec.ts`: backend unit tests colocated with source modules.

## Verification

Run from `backend/`:

```bash
npx prisma generate
npm test -- --runInBand
npm run build
```

The full E2E suite additionally requires the environment variables and infrastructure documented in `backend/.env.example` and `backend/docker-compose.yml`.
