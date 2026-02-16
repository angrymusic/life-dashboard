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
RATE_LIMIT_BACKEND=database
RATE_LIMIT_PRUNE_INTERVAL_MS=300000
TRUST_PROXY_HEADERS=true
TRUST_PROXY_IP_HEADER=cf-connecting-ip
CSP_MODE=enforce
MIGRATION_STAGING_DIR=./data/migration-staging
MIGRATION_STAGING_RETENTION_DAYS=7
MIGRATION_STAGING_MAX_FILES_PER_USER=30
ENABLE_MIGRATION_IMPORT=false
PHOTO_UPLOAD_RATE_LIMIT=30
PHOTO_UPLOAD_RATE_WINDOW_MS=60000
SYNC_APPLY_RATE_LIMIT=120
SYNC_APPLY_RATE_WINDOW_MS=60000
SYNC_APPLY_MAX_BYTES=1048576
SYNC_APPLY_MAX_EVENTS=2000
DASHBOARD_MEMBERS_MAX_BYTES=65536
DASHBOARD_MEMBERS_RATE_LIMIT=60
DASHBOARD_MEMBERS_RATE_WINDOW_MS=60000
DASHBOARD_SNAPSHOT_MAX_BYTES=2097152
GEOCODE_SEARCH_RATE_LIMIT=60
GEOCODE_SEARCH_RATE_WINDOW_MS=60000
GEOCODE_SEARCH_TIMEOUT_MS=5000
GEOCODE_REVERSE_RATE_LIMIT=60
GEOCODE_REVERSE_RATE_WINDOW_MS=60000
GEOCODE_REVERSE_TIMEOUT_MS=5000
SPECIAL_DAYS_RATE_LIMIT=30
SPECIAL_DAYS_RATE_WINDOW_MS=60000
SPECIAL_DAYS_TIMEOUT_MS=8000
MIGRATION_IMPORT_RATE_LIMIT=5
MIGRATION_IMPORT_RATE_WINDOW_MS=600000
MIGRATION_IMPORT_MAX_BYTES=5242880
MIGRATION_IMPORT_MAX_RECORDS=20000
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
  Orphaned photo files are cleaned up when related photo records are removed.
- Set `TRUST_PROXY_HEADERS=true` only when requests are always behind a trusted
  proxy (for example Cloudflare Tunnel), and set `TRUST_PROXY_IP_HEADER` to the
  header your proxy controls (`cf-connecting-ip`, `x-real-ip`, or
  `x-forwarded-for`).
- `CSP_MODE` defaults to `enforce`. Use `report-only` only for temporary tuning.
- Migration import API is disabled by default. To use it, set
  `ENABLE_MIGRATION_IMPORT=true`.
- Migration import stages snapshots on disk under `MIGRATION_STAGING_DIR`.
  Staged files are pruned by age and count per user.
