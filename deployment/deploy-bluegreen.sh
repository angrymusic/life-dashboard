#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CONTROL_REPO_DIR="${CONTROL_REPO_DIR:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
SLOT_ENV_DIR="${SLOT_ENV_DIR:-$SCRIPT_DIR/slots}"
SLOTS_ROOT="${SLOTS_ROOT:-/home/angrymusic/apps/life-dashboard}"
REPO_BRANCH="${REPO_BRANCH:-main}"
REPO_URL="${REPO_URL:-$(git -C "$CONTROL_REPO_DIR" remote get-url origin 2>/dev/null || true)}"

BLUE_SLOT="${BLUE_SLOT:-blue}"
GREEN_SLOT="${GREEN_SLOT:-green}"
BLUE_PORT="${BLUE_PORT:-3001}"
GREEN_PORT="${GREEN_PORT:-3002}"

APP_SERVICE_PREFIX="${APP_SERVICE_PREFIX:-life-dashboard-next@}"
HEALTH_PATH="${HEALTH_PATH:-/}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-60}"
HEALTH_INTERVAL_SECONDS="${HEALTH_INTERVAL_SECONDS:-2}"

ACTIVE_SLOT_FILE="${ACTIVE_SLOT_FILE:-$SCRIPT_DIR/.active-slot}"
CADDY_UPSTREAM_FILE="${CADDY_UPSTREAM_FILE:-/etc/caddy/lifedashboard/upstream.caddy}"
SUDO_BIN="${SUDO_BIN:-sudo}"

log() {
  printf '[%s] %s\n' "$(date '+%F %T')" "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

run_root() {
  if [ "$(id -u)" -eq 0 ] || [ -z "$SUDO_BIN" ]; then
    "$@"
    return
  fi
  "$SUDO_BIN" "$@"
}

slot_to_port() {
  case "$1" in
    "$BLUE_SLOT") printf '%s\n' "$BLUE_PORT" ;;
    "$GREEN_SLOT") printf '%s\n' "$GREEN_PORT" ;;
    *) return 1 ;;
  esac
}

port_to_slot() {
  case "$1" in
    "$BLUE_PORT") printf '%s\n' "$BLUE_SLOT" ;;
    "$GREEN_PORT") printf '%s\n' "$GREEN_SLOT" ;;
    *) return 1 ;;
  esac
}

read_active_slot_from_state() {
  [ -f "$ACTIVE_SLOT_FILE" ] || return 1
  local slot
  slot="$(tr -d '[:space:]' < "$ACTIVE_SLOT_FILE")"
  case "$slot" in
    "$BLUE_SLOT" | "$GREEN_SLOT")
      printf '%s\n' "$slot"
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

read_active_slot_from_caddy() {
  [ -f "$CADDY_UPSTREAM_FILE" ] || return 1
  local port
  port="$(sed -nE 's/.*:([0-9]+).*/\1/p' "$CADDY_UPSTREAM_FILE" | head -n 1)"
  [ -n "$port" ] || return 1
  port_to_slot "$port"
}

pick_target_slot() {
  local active_slot="${1:-}"
  if [ -z "$active_slot" ] || [ "$active_slot" = "$GREEN_SLOT" ]; then
    printf '%s\n' "$BLUE_SLOT"
    return
  fi
  printf '%s\n' "$GREEN_SLOT"
}

ensure_slot_env_file() {
  local slot="$1"
  local env_file="$SLOT_ENV_DIR/$slot.env"
  [ -f "$env_file" ] || fail "Missing slot env file: $env_file"
}

sync_slot_repo() {
  local slot="$1"
  local slot_dir="$SLOTS_ROOT/$slot"

  mkdir -p "$SLOTS_ROOT"

  if [ ! -d "$slot_dir/.git" ]; then
    log "Clone repository to $slot_dir"
    git clone --branch "$REPO_BRANCH" "$REPO_URL" "$slot_dir"
  else
    log "Update repository in $slot_dir"
    git -C "$slot_dir" fetch origin "$REPO_BRANCH"
    git -C "$slot_dir" checkout "$REPO_BRANCH"
    git -C "$slot_dir" pull --ff-only origin "$REPO_BRANCH"
  fi
}

build_slot() {
  local slot="$1"
  local slot_dir="$SLOTS_ROOT/$slot"

  log "Install dependencies in $slot slot"
  pnpm --dir "$slot_dir" install --frozen-lockfile

  log "Build $slot slot"
  pnpm --dir "$slot_dir" build
}

start_slot_service() {
  local slot="$1"
  local service_name="${APP_SERVICE_PREFIX}${slot}.service"

  log "Restart $service_name"
  run_root systemctl restart "$service_name"
}

stop_slot_service() {
  local slot="$1"
  local service_name="${APP_SERVICE_PREFIX}${slot}.service"

  log "Stop $service_name"
  run_root systemctl stop "$service_name" || true
}

wait_for_health() {
  local slot="$1"
  local port="$2"
  local url="http://127.0.0.1:${port}${HEALTH_PATH}"
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))

  log "Health check for $slot slot at $url"
  until curl -fsS "$url" >/dev/null 2>&1; do
    if (( SECONDS >= deadline )); then
      fail "Health check timeout: $url"
    fi
    sleep "$HEALTH_INTERVAL_SECONDS"
  done
}

switch_caddy_upstream() {
  local port="$1"
  local upstream_dir
  upstream_dir="$(dirname "$CADDY_UPSTREAM_FILE")"

  log "Write Caddy upstream file: $CADDY_UPSTREAM_FILE"
  run_root mkdir -p "$upstream_dir"
  printf 'reverse_proxy 127.0.0.1:%s\n' "$port" | run_root tee "$CADDY_UPSTREAM_FILE" >/dev/null

  log "Reload caddy"
  run_root systemctl reload caddy
}

persist_active_slot() {
  local slot="$1"
  local state_dir
  state_dir="$(dirname "$ACTIVE_SLOT_FILE")"
  mkdir -p "$state_dir"
  printf '%s\n' "$slot" > "$ACTIVE_SLOT_FILE"
}

main() {
  require_cmd git
  require_cmd pnpm
  require_cmd curl
  require_cmd systemctl
  require_cmd tee

  [ -n "$REPO_URL" ] || fail "REPO_URL is empty. Set REPO_URL or configure origin in $CONTROL_REPO_DIR."

  ensure_slot_env_file "$BLUE_SLOT"
  ensure_slot_env_file "$GREEN_SLOT"

  local active_slot=""
  if active_slot="$(read_active_slot_from_state)"; then
    log "Active slot from state file: $active_slot"
  elif active_slot="$(read_active_slot_from_caddy)"; then
    log "Active slot from caddy upstream: $active_slot"
  else
    log "No active slot detected. This looks like first deployment."
  fi

  local target_slot
  target_slot="$(pick_target_slot "$active_slot")"
  local target_port
  target_port="$(slot_to_port "$target_slot")"

  log "Target slot: $target_slot ($target_port)"

  stop_slot_service "$target_slot"
  sync_slot_repo "$target_slot"
  build_slot "$target_slot"
  start_slot_service "$target_slot"
  wait_for_health "$target_slot" "$target_port"
  switch_caddy_upstream "$target_port"
  persist_active_slot "$target_slot"

  if [ -n "$active_slot" ] && [ "$active_slot" != "$target_slot" ]; then
    stop_slot_service "$active_slot"
  fi

  log "Deployment completed. Active slot is now: $target_slot"
}

main "$@"
