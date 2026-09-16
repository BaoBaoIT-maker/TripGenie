# TripGenie

TripGenie is a full-stack tourism discovery and itinerary-planning platform. It combines a Next.js frontend for exploring places, nearby-map discovery, community content, and editable trip planning with a NestJS backend for authentication, place ingestion, enrichment, and search.

## Repository structure

| Path | Purpose |
| --- | --- |
| `frontend/` | Next.js 16, React 19, TypeScript, Tailwind CSS, TanStack Query, Zustand, VietMap |
| `trip-genie/` | NestJS 11 API, Prisma, PostgreSQL/PostGIS, Redis, BullMQ |
| `test/` | Frontend unit and component tests |
| `docs/` | Product specifications and implementation plans |

## Current features

- Place discovery, search, category filtering, details, collections, and community pages.
- Nearby-place map with radius and category controls, geolocation fallback, markers, and place cards.
- AI-generated and manual itinerary flows with editable trip details.
- Drag-and-drop itinerary stops, place search, budget summaries, preview, and local persistence.
- Mock companion invitations for testing the complete collaboration interface.
- Backend authentication, JWT revocation, place crawling and enrichment, and PostGIS-backed search.

## Prerequisites

- Node.js 20 or newer
- npm
- Docker Desktop for the backend infrastructure

## Frontend setup

```bash
cd frontend
npm install
```

Copy `frontend/.env.example` to `frontend/.env.local`, provide a domain-restricted VietMap key, then run:

```bash
npm run dev
```

The frontend is available at `http://localhost:3000`.

## Backend setup

```bash
cd trip-genie
npm install
npx prisma generate
docker compose up -d
```

Copy `trip-genie/.env.example` to `trip-genie/.env`. When the frontend is also running locally, set the backend `PORT` to `3001` and start the API:

```bash
npm run start:dev
```

Never commit real API keys, OAuth secrets, JWT secrets, or database credentials.

## Verification

Frontend:

```bash
cd frontend
npm test
npm run lint
npm run build
```

Backend:

```bash
cd trip-genie
npm test
npm run build
```

## Branches

- `main`: stable project history.
- `develop`: active integration branch for backend and frontend work.

## License

See [LICENSE](LICENSE).
