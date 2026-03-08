# LifeDashboard

LifeDashboard는 로컬 우선(local-first) 방식의 개인 대시보드 빌더입니다.
위젯을 드래그로 배치할 수 있고, 선택적으로 공유도 가능합니다.
데이터는 브라우저(IndexedDB)에 저장되며 로그인 시 Postgres와 동기화됩니다.

## 주요 기능

- 드래그/리사이즈 그리드 레이아웃 기반의 다중 대시보드
- 위젯: Calendar, Memo, Photo, Todo, D-day, Mood, Chart(지표), Weather
- Dexie + outbox 기반 로컬 우선 저장 및 동기화 파이프라인
- NextAuth(Google 로그인) 기반 공유 대시보드/멤버 권한
- 공유 대시보드 편집 시 위젯 잠금으로 동시 수정 충돌 완화
- 게스트 온보딩과 모바일 홈 화면 설치 안내
- 스냅샷 내보내기/가져오기 엔드포인트 및 마이그레이션 스테이징
- 디스크 기반 사진 업로드 저장

## 기술 스택

- Next.js App Router, React, TypeScript
- Prisma + PostgreSQL
- NextAuth (Google 제공자)
- Dexie (IndexedDB, 로컬 저장)
- Tailwind CSS 4, Radix UI, React Grid Layout, Recharts

## 시작하기

### 요구 사항

- Node.js 20+
- PostgreSQL

### 설정

1. 의존성 설치:

```bash
pnpm install
```

2. 개발/운영용 env 파일 생성:

```bash
# .env.development.local (pnpm dev 실행 시 사용)
DATABASE_URL=postgresql://user:pass@localhost:5432/lifedashboard?schema=public
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-me
GOOGLE_CLIENT_ID=replace-me
GOOGLE_CLIENT_SECRET=replace-me
DATA_GO_KR_SERVICE_KEY=replace-me
```

```bash
# .env.production.local (pnpm build/start 실행 시 사용)
DATABASE_URL=postgresql://user:pass@host:5432/lifedashboard?schema=public
NEXTAUTH_URL=https://lifedashboard.example.com
NEXTAUTH_SECRET=replace-me
GOOGLE_CLIENT_ID=replace-me
GOOGLE_CLIENT_SECRET=replace-me
DATA_GO_KR_SERVICE_KEY=replace-me
```

선택 설정 (두 env 파일 중 필요한 곳에 추가):

```bash
UPLOAD_DIR=./data/uploads
UPLOAD_MAX_BYTES=10485760
NEXT_PUBLIC_APP_URL=https://lifedashboard.example.com
RATE_LIMIT_BACKEND=database
RATE_LIMIT_PRUNE_INTERVAL_MS=300000
TRUST_PROXY_HEADERS=true
TRUST_PROXY_IP_HEADER=cf-connecting-ip
CSP_MODE=enforce
WIDGET_LOCK_TTL_MS=60000
MIGRATION_STAGING_DIR=./data/migration-staging
MIGRATION_STAGING_RETENTION_DAYS=7
MIGRATION_STAGING_MAX_FILES_PER_USER=30
ENABLE_MIGRATION_IMPORT=false
MIGRATION_IMPORT_TOKEN=replace-with-long-random-token
PHOTO_UPLOAD_RATE_LIMIT=30
PHOTO_UPLOAD_RATE_WINDOW_MS=60000
UPLOAD_PENDING_TTL_MS=86400000
UPLOAD_PENDING_MAX_FILES=300
UPLOAD_PENDING_MAX_BYTES=209715200
UPLOAD_PENDING_PRUNE_INTERVAL_MS=60000
UPLOAD_PENDING_PRUNE_BATCH_SIZE=100
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
GEOCODE_REQUIRE_AUTH=true
SPECIAL_DAYS_RATE_LIMIT=30
SPECIAL_DAYS_RATE_WINDOW_MS=60000
SPECIAL_DAYS_TIMEOUT_MS=8000
MIGRATION_IMPORT_RATE_LIMIT=5
MIGRATION_IMPORT_RATE_WINDOW_MS=600000
MIGRATION_IMPORT_MAX_BYTES=5242880
MIGRATION_IMPORT_MAX_RECORDS=20000
```

### 환경 변수 설명

| 변수 | 설명 (한글) | 기본값 / 비고 |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL 접속 문자열입니다. | 필수 |
| `NEXTAUTH_URL` | NextAuth 기준 URL(콜백/Origin 기준)입니다. | 필수 |
| `NEXTAUTH_SECRET` | 세션/토큰 암호화용 시크릿입니다. | 필수 |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID입니다. | 필수 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트 시크릿입니다. | 필수 |
| `DATA_GO_KR_SERVICE_KEY` | 공휴일/기념일 API(Data.go.kr) 키입니다. | 필수 |
| `UPLOAD_DIR` | 업로드 파일 저장 루트 경로입니다. | `./data/uploads` |
| `UPLOAD_MAX_BYTES` | 1개 이미지 업로드 최대 바이트입니다. | `10485760` (10MB) |
| `NEXT_PUBLIC_APP_URL` | 공개 메타데이터/캐노니컬 URL 기준 주소입니다. | 기본 `NEXTAUTH_URL` 순으로 fallback |
| `UPLOAD_PENDING_TTL_MS` | 임시 업로드(PendingUpload) 만료 시간(ms)입니다. | `86400000` (24시간) |
| `UPLOAD_PENDING_MAX_FILES` | 사용자별 임시 업로드 최대 파일 수입니다. | `300` |
| `UPLOAD_PENDING_MAX_BYTES` | 사용자별 임시 업로드 총 용량 제한(바이트)입니다. | `209715200` (200MB) |
| `UPLOAD_PENDING_PRUNE_INTERVAL_MS` | 만료 임시 업로드 정리 주기(ms)입니다. | `60000` |
| `UPLOAD_PENDING_PRUNE_BATCH_SIZE` | 1회 정리 시 처리할 만료 레코드 수입니다. | `100` |
| `RATE_LIMIT_BACKEND` | 레이트리밋 저장소입니다(`database`/`memory`). | `database` |
| `RATE_LIMIT_PRUNE_INTERVAL_MS` | DB 레이트리밋 만료 레코드 정리 주기(ms)입니다. | `300000` |
| `TRUST_PROXY_HEADERS` | 프록시 IP 헤더를 신뢰할지 여부입니다. | 기본 `false` |
| `TRUST_PROXY_IP_HEADER` | 신뢰할 클라이언트 IP 헤더명입니다. | `cf-connecting-ip` |
| `CSP_MODE` | CSP 적용 모드입니다(`enforce`/`report-only`). | `enforce` |
| `WIDGET_LOCK_TTL_MS` | 공유 대시보드 위젯 편집 잠금 유지 시간(ms)입니다. | `60000` |
| `PHOTO_UPLOAD_RATE_LIMIT` | 사진 업로드 API 요청 허용 횟수입니다. | `30` |
| `PHOTO_UPLOAD_RATE_WINDOW_MS` | 사진 업로드 레이트리밋 윈도우(ms)입니다. | `60000` |
| `SYNC_APPLY_RATE_LIMIT` | `/api/sync/apply` 요청 허용 횟수입니다. | `120` |
| `SYNC_APPLY_RATE_WINDOW_MS` | `/api/sync/apply` 레이트리밋 윈도우(ms)입니다. | `60000` |
| `SYNC_APPLY_MAX_BYTES` | `/api/sync/apply` 요청 본문 최대 크기(바이트)입니다. | `1048576` (1MB) |
| `SYNC_APPLY_MAX_EVENTS` | `/api/sync/apply`에서 한 번에 처리할 최대 이벤트 수입니다. | `2000` |
| `DASHBOARD_MEMBERS_MAX_BYTES` | 멤버 관리 API 본문 최대 크기(바이트)입니다. | `65536` |
| `DASHBOARD_MEMBERS_RATE_LIMIT` | 멤버 관리 API 요청 허용 횟수입니다. | `60` |
| `DASHBOARD_MEMBERS_RATE_WINDOW_MS` | 멤버 관리 API 레이트리밋 윈도우(ms)입니다. | `60000` |
| `DASHBOARD_SNAPSHOT_MAX_BYTES` | 스냅샷 저장 API 본문 최대 크기(바이트)입니다. | `2097152` (2MB) |
| `GEOCODE_REQUIRE_AUTH` | 지오코딩 API 로그인 필수 여부입니다. | 기본 `true` |
| `GEOCODE_SEARCH_RATE_LIMIT` | 지오코딩 검색 API 요청 허용 횟수입니다. | `60` |
| `GEOCODE_SEARCH_RATE_WINDOW_MS` | 지오코딩 검색 레이트리밋 윈도우(ms)입니다. | `60000` |
| `GEOCODE_SEARCH_TIMEOUT_MS` | 지오코딩 검색 외부 API 타임아웃(ms)입니다. | `5000` |
| `GEOCODE_REVERSE_RATE_LIMIT` | 역지오코딩 API 요청 허용 횟수입니다. | `60` |
| `GEOCODE_REVERSE_RATE_WINDOW_MS` | 역지오코딩 레이트리밋 윈도우(ms)입니다. | `60000` |
| `GEOCODE_REVERSE_TIMEOUT_MS` | 역지오코딩 외부 API 타임아웃(ms)입니다. | `5000` |
| `SPECIAL_DAYS_RATE_LIMIT` | 공휴일/기념일 API 요청 허용 횟수입니다. | `30` |
| `SPECIAL_DAYS_RATE_WINDOW_MS` | 공휴일/기념일 API 레이트리밋 윈도우(ms)입니다. | `60000` |
| `SPECIAL_DAYS_TIMEOUT_MS` | 공휴일/기념일 외부 API 타임아웃(ms)입니다. | `8000` |
| `MIGRATION_STAGING_DIR` | 마이그레이션 import 스냅샷 임시 저장 경로입니다. | `./data/migration-staging` |
| `MIGRATION_STAGING_RETENTION_DAYS` | 임시 스냅샷 보관 일수입니다. | `7` |
| `MIGRATION_STAGING_MAX_FILES_PER_USER` | 사용자별 임시 스냅샷 최대 파일 수입니다. | `30` |
| `ENABLE_MIGRATION_IMPORT` | 마이그레이션 import API 활성화 여부입니다. | `false` |
| `MIGRATION_IMPORT_TOKEN` | 마이그레이션 import API 인증 토큰입니다(`x-migration-import-token`). | import 사용 시 필수 |
| `MIGRATION_IMPORT_RATE_LIMIT` | 마이그레이션 import API 요청 허용 횟수입니다. | `5` |
| `MIGRATION_IMPORT_RATE_WINDOW_MS` | 마이그레이션 import API 레이트리밋 윈도우(ms)입니다. | `600000` |
| `MIGRATION_IMPORT_MAX_BYTES` | 마이그레이션 import 본문 최대 크기(바이트)입니다. | `5242880` (5MB) |
| `MIGRATION_IMPORT_MAX_RECORDS` | 마이그레이션 import에서 허용하는 최대 레코드 수입니다. | `20000` |
| `NODE_ENV` | 런타임 모드입니다(`development`/`production`). | 보통 스크립트에서 자동 설정 |

> 운영 권장: Cloudflare Tunnel 환경에서 `TRUST_PROXY_HEADERS=true`, `TRUST_PROXY_IP_HEADER=cf-connecting-ip`를 사용하고 원본 서버 직접 접근은 방화벽으로 차단하세요.

3. 데이터베이스 마이그레이션 적용:

```bash
pnpm prisma migrate dev
```

4. 개발 서버 실행:

```bash
pnpm dev
```

브라우저에서 `http://localhost:3000`을 열어 확인합니다.

## 스크립트

- `pnpm dev` - 개발 서버 실행
- `pnpm build` - 운영 빌드
- `pnpm start` - 운영 서버 실행
- `pnpm lint` - ESLint 실행
- `pnpm test` - Vitest 단위/라우트 테스트 실행
- `pnpm test:watch` - Vitest watch 모드 실행

## 테스트 전략

- 권한 로직: `src/feature/dashboard/libs/permissions.test.ts`
  - 공유/개인 대시보드, parent/child, 작성자 일치 여부를 단위 테스트로 검증합니다.
- 동기화 적용 로직: `src/app/api/sync/apply/route.test.ts`
  - 비인증(401), 권한 거부(207), 허용(200), 혼합 배치(부분 성공 207) 흐름을 검증합니다.

## 프로젝트 구조

- `src/app` - Next.js 라우트, API 핸들러, providers
- `src/feature` - 대시보드 UI 및 위젯 구현
- `src/shared` - 클라이언트 데이터 레이어(Dexie, sync, queries)
- `src/server` - 인증 및 Prisma 클라이언트
- `prisma` - Prisma 스키마 및 마이그레이션
- `public` - 정적 에셋

## 참고 사항

- 사진 업로드 파일은 `UPLOAD_DIR`(기본 `data/uploads`) 아래에 저장됩니다.
  임시 업로드는 추적되며, 만료 파일은 자동 정리됩니다.
  관련 사진(photo) 레코드가 삭제되면 고아(orphan) 파일도 함께 정리됩니다.
- 공개 배포에서 메타데이터/캐노니컬 URL을 명확히 하려면 `NEXT_PUBLIC_APP_URL`을 설정하세요.
  미설정 시 `NEXTAUTH_URL`, Vercel 기본 URL 순으로 fallback 합니다.
- `TRUST_PROXY_HEADERS=true`는 요청이 항상 신뢰 가능한 프록시(예: Cloudflare Tunnel)를 거칠 때만 사용하세요.
  `TRUST_PROXY_IP_HEADER`는 프록시가 제어하는 헤더(`cf-connecting-ip`, `x-real-ip`, `x-forwarded-for`)로 설정해야 합니다.
- `CSP_MODE` 기본값은 `enforce`입니다. `report-only`는 정책 튜닝 시 일시적으로만 사용하세요.
- 공유 대시보드에서 위젯 편집 잠금은 기본 60초 뒤 자동 만료됩니다.
  필요하면 `WIDGET_LOCK_TTL_MS`로 유지 시간을 조정하세요.
- 지오코딩(Geocode) API는 기본적으로 인증이 필요합니다.
  신뢰 가능한 사설 환경에서만 `GEOCODE_REQUIRE_AUTH=false`를 고려하세요.
- 마이그레이션 import API는 기본 비활성화 상태입니다.
  사용하려면 `ENABLE_MIGRATION_IMPORT=true`와 `MIGRATION_IMPORT_TOKEN`을 설정하세요.
- 마이그레이션 import 요청에는 반드시 `x-migration-import-token: <MIGRATION_IMPORT_TOKEN>` 헤더가 포함되어야 합니다.
- 마이그레이션 import는 스냅샷을 `MIGRATION_STAGING_DIR`에 임시 저장하며,
  사용자별 파일 개수/보관 기간 기준으로 자동 정리됩니다.
- 민감 정보 저장을 줄이기 위해 OAuth 계정 토큰 필드는 로그인/연동 이후 정리됩니다.
