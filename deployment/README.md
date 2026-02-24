# deployment

무중단(blue/green) 배포를 위한 최소 구성입니다.

흐름은 아래 순서입니다.

1. 비활성 슬롯(`blue`/`green`) 코드 업데이트 + 빌드
2. 비활성 슬롯 systemd 서비스 재기동
3. 신규 슬롯 헬스체크
4. Caddy upstream 파일 갱신 + Caddy 반영(`active`면 reload, 아니면 start)
5. 이전 슬롯 서비스 중지

## 포함 파일

- `deploy-bluegreen.sh`: 배포 자동화 스크립트
- `life-dashboard-next@.service`: 슬롯별 systemd 템플릿 서비스
- `slots/*.env`: 슬롯별 경로/포트/업로드 경로
- `caddy/Caddyfile.example`: Caddyfile 예시
- `caddy/upstream.caddy.example`: active upstream 파일 예시
- `.github/workflows/deploy-main.yml`: GitHub Actions 배포 워크플로

## 사전 조건

- 서버에 `git`, `pnpm`, `curl`, `systemd`, `caddy`, `cloudflared` 설치
- 서버 사용자에 `sudo systemctl restart/stop/reload` 권한(비밀번호 없이) 부여
- cloudflare tunnel은 `service: http://localhost:3000` 유지
- 기존 단일 앱 서비스(`life-dashboard-next.service`)는 포트 충돌 방지를 위해 중지/비활성화

## Caddy 설치 (Ubuntu/Debian)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

설치 확인:

```bash
systemctl status caddy --no-pager
```

## 1) 슬롯 env 파일 준비

`blue.env`, `green.env`의 `APP_DIR`/`PORT`/`UPLOAD_DIR`를 서버 실경로에 맞게 수정합니다.

예시:

```bash
APP_DIR=/home/angrymusic/apps/life-dashboard/blue
PORT=3001
UPLOAD_DIR=/home/angrymusic/projects/life-dashboard/data/uploads
```

```bash
APP_DIR=/home/angrymusic/apps/life-dashboard/green
PORT=3002
UPLOAD_DIR=/home/angrymusic/projects/life-dashboard/data/uploads
```

`UPLOAD_DIR`는 반드시 절대경로를 권장합니다.  
상대경로(`./data/uploads`)를 쓰면 blue/green 슬롯 전환 시 서로 다른 디렉터리를 바라볼 수 있습니다.

## 2) systemd 템플릿 서비스 설치

```bash
sudo cp deployment/life-dashboard-next@.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable life-dashboard-next@blue.service
sudo systemctl enable life-dashboard-next@green.service
```

`life-dashboard-next@.service` 안의 아래 항목은 서버 환경에 맞게 반드시 수정하세요.

- `User`
- `Environment=PATH=...`
- `ExecStart`의 `pnpm` 절대 경로
- `.env.production` 경로

## 3) Caddy 설정

최소 예시는 `deployment/caddy/Caddyfile.example`를 기준으로 구성합니다.

```bash
sudo cp deployment/caddy/Caddyfile.example /etc/caddy/Caddyfile
sudo mkdir -p /etc/caddy/lifedashboard
sudo cp deployment/caddy/upstream.caddy.example /etc/caddy/lifedashboard/upstream.caddy
```

이 예시는 Caddy가 `:3000`에서 리슨하며, Cloudflare Tunnel(`localhost:3000`) 요청을 받아
`upstream.caddy`에 지정된 슬롯(`3001` 또는 `3002`)으로 프록시합니다.

적용:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable caddy
sudo systemctl restart caddy
```

기존 단일 앱(3000) 서비스 정리:

```bash
sudo systemctl stop life-dashboard-next.service
sudo systemctl disable life-dashboard-next.service
```

Cloudflare Tunnel 설정 확인(`~/.cloudflared/config.yml`):

```yaml
ingress:
  - hostname: your-domain.example.com
    service: http://localhost:3000
  - service: http_status:404
```

설정 반영:

```bash
sudo systemctl restart cloudflared-tunnel.service
```

로컬 확인:

```bash
curl -i http://127.0.0.1:3000/
```

## 4) 첫 배포 실행

```bash
chmod +x deployment/deploy-bluegreen.sh
./deployment/deploy-bluegreen.sh
```

기본 동작:

- active 슬롯 탐지(`deployment/.active-slot` 우선, 없으면 Caddy upstream 추론)
- 반대 슬롯(비활성) 리포를 원격 브랜치 상태로 동기화
- 빌드 환경파일 동기화(`.env.production.local` 우선, 없으면 `.env.production`)
- `pnpm install -> pnpm exec prisma generate -> pnpm build`
- 반대 슬롯 기동
- `http://127.0.0.1:{port}/` 헬스체크
- Caddy upstream 변경 + 반영(`reload` 또는 `start`)
- 이전 슬롯 정지

## 5) CI 연결 (self-hosted runner)

워크플로 파일은 `.github/workflows/deploy-main.yml`을 사용합니다.
트리거는 `push(main)`과 `workflow_dispatch`(Run workflow 버튼)입니다.

현재 워크플로는 `self-hosted` 러너에서 로컬 배포 스크립트를 직접 실행합니다.
SSH 기반(`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`) 시크릿은 사용하지 않습니다.

러너 등록 후(Repository Settings > Actions > Runners), 러너 서버에서 서비스 등록:

```bash
cd ~/actions-runner
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

## 내가 해야 할 일 체크리스트

1. Caddy 설치 후 `systemctl status caddy` 확인
2. `deployment/slots/blue.env`, `green.env`의 `APP_DIR`, `PORT`, `UPLOAD_DIR` 확인
3. `/etc/systemd/system/life-dashboard-next@.service` 설치 + `daemon-reload`
4. `life-dashboard-next@blue.service`, `life-dashboard-next@green.service` enable
5. `/etc/caddy/Caddyfile`와 `/etc/caddy/lifedashboard/upstream.caddy` 배치 후 Caddy 재시작
6. 기존 `life-dashboard-next.service` stop/disable (3000 포트 해제)
7. cloudflared ingress `service: http://localhost:3000` 확인 후 cloudflared 재시작
8. `./deployment/deploy-bluegreen.sh` 수동 1회 실행해서 배포/전환 검증
9. self-hosted runner 등록 후 `./svc.sh install/start`로 상시 실행
10. Actions 탭에서 `Run workflow` 수동 실행 테스트

## 스크립트 주요 환경변수

- `REPO_BRANCH` 기본 `main`
- `SLOTS_ROOT` 기본 `/home/angrymusic/apps/life-dashboard`
- `HEALTH_PATH` 기본 `/`
- `HEALTH_TIMEOUT_SECONDS` 기본 `60`
- `CADDY_UPSTREAM_FILE` 기본 `/etc/caddy/lifedashboard/upstream.caddy`
- `APP_SERVICE_PREFIX` 기본 `life-dashboard-next@`
- `CONTROL_REPO_DIR` 기본: 스크립트 상위 디렉터리

GitHub Actions(self-hosted)에서는 아래 환경변수를 워크플로에 고정하는 것을 권장합니다.

```yaml
env:
  CONTROL_REPO_DIR: /home/angrymusic/projects/life-dashboard
```

## 롤백

직전 슬롯으로 강제 전환하려면:

1. `/etc/caddy/lifedashboard/upstream.caddy`를 이전 포트(`3001` 또는 `3002`)로 수정
2. `sudo systemctl reload caddy`
3. 해당 슬롯 서비스(`life-dashboard-next@blue|green`) 재시작
