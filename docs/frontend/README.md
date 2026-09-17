# Frontend Documentation

This directory owns documentation for the Next.js application in `frontend/`.

## Locations

- `superpowers/plans/`: step-by-step frontend implementation plans.
- `superpowers/specs/`: reviewed frontend feature and interaction designs.
- `../../test/frontend/`: frontend unit and component tests.

## Verification

Run from `frontend/`:

```bash
npm test
npm run lint
npm run build
```

New frontend plans and specs must stay under this directory. Cross-workspace decisions belong in `docs/architecture/`.
