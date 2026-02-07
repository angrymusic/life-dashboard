# LifeDashboard

LifeDashboard is a local-first personal dashboard builder with draggable widgets
and optional sharing. Data is stored in the browser (IndexedDB) and synced to
Postgres when signed in.

## Features

- Multiple dashboards with drag and resize grid layout.
- Widgets: Calendar, Memo, Photo, Todo, D-day, Mood, Chart (metrics), Weather.
- Local-first storage with Dexie and an outbox-based sync pipeline.
- Google sign-in via NextAuth for shared dashboards and member roles.
- Snapshot export/import endpoints and migration staging.
- Photo uploads saved on disk.

## Tech Stack

- Next.js App Router, React, TypeScript
- Prisma + PostgreSQL
- NextAuth (Google provider)
- Dexie (IndexedDB) for local storage
- Tailwind CSS 4, Radix UI, React Grid Layout, Recharts

## Getting Started

### Requirements

- Node.js 20+
- PostgreSQL

### Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create env files for dev/prod:

```bash
# .env.development.local (pnpm dev)
DATABASE_URL=postgresql://user:pass@localhost:5432/lifedashboard?schema=public
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-me
GOOGLE_CLIENT_ID=replace-me
GOOGLE_CLIENT_SECRET=replace-me
DATA_GO_KR_SERVICE_KEY=replace-me
```

```bash
# .env.production.local (pnpm build/start)
DATABASE_URL=postgresql://user:pass@host:5432/lifedashboard?schema=public
NEXTAUTH_URL=https://lifedashboard.example.com
NEXTAUTH_SECRET=replace-me
GOOGLE_CLIENT_ID=replace-me
GOOGLE_CLIENT_SECRET=replace-me
DATA_GO_KR_SERVICE_KEY=replace-me
```

Optional (add to either env file):

```bash
UPLOAD_DIR=./data/uploads
UPLOAD_MAX_BYTES=10485760
MIGRATION_STAGING_DIR=./data/migration-staging
```

3. Apply database migrations:

```bash
pnpm prisma migrate dev
```

4. Run the dev server:

```bash
pnpm dev
```

Open http://localhost:3000.

## Scripts

- `pnpm dev` - start dev server
- `pnpm build` - production build
- `pnpm start` - start production server
- `pnpm lint` - run ESLint

## Project Structure

- `src/app` - Next.js routes, API handlers, providers
- `src/feature` - dashboard UI and widget implementations
- `src/shared` - client-side data layer (Dexie, sync, queries)
- `src/server` - auth and Prisma client
- `prisma` - Prisma schema and migrations
- `public` - static assets

## Notes

- Photo uploads are stored under `UPLOAD_DIR` (default `data/uploads`).
- Migration import currently stages snapshots on disk under
  `MIGRATION_STAGING_DIR`.
