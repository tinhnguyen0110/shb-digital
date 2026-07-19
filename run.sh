#!/usr/bin/env bash
# One-command local launcher for the SHB credit assessment support system.
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
TOOLS_DIR="$ROOT_DIR/.tools/bin"
DEFAULT_DATABASE_URL="postgresql://shb:shb@localhost:5432/shb"
BACKEND_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:5173"

BACKEND_PID=""
FRONTEND_PID=""

info() { printf '\033[1;34m→\033[0m %s\n' "$*"; }
ok() { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
die() {
  printf '\033[1;31m✗\033[0m %s\n' "$*" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

backend_is_ready() {
  curl -fsS "$BACKEND_URL/api/health" 2>/dev/null |
    grep -Eq '"ok"[[:space:]]*:[[:space:]]*true'
}

frontend_is_ready() {
  curl -fsS "$FRONTEND_URL" 2>/dev/null |
    grep -Eq 'id=["'\'']root["'\'']'
}

cleanup() {
  trap - EXIT INT TERM
  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  [ -n "$FRONTEND_PID" ] && wait "$FRONTEND_PID" 2>/dev/null || true
  [ -n "$BACKEND_PID" ] && wait "$BACKEND_PID" 2>/dev/null || true
}

wait_for_url() {
  local name="$1"
  local pid="$2"
  local check_function="$3"
  local attempts=40

  while [ "$attempts" -gt 0 ]; do
    "$check_function" && return 0
    kill -0 "$pid" 2>/dev/null || die "$name đã dừng trước khi sẵn sàng."
    attempts=$((attempts - 1))
    sleep 1
  done
  die "$name không sẵn sàng sau 40 giây."
}

ensure_docker() {
  command_exists docker || die "Chưa có Docker. Cài Docker Desktop/Engine rồi chạy lại ./run.sh."
  docker compose version >/dev/null 2>&1 ||
    die "Docker Compose chưa sẵn sàng. Cài Docker Compose v2 rồi chạy lại."

  if docker info >/dev/null 2>&1; then
    return
  fi

  if [ "$(uname -s)" = "Darwin" ] && command_exists open; then
    info "Docker chưa chạy; đang mở Docker Desktop..."
    open -a Docker >/dev/null 2>&1 ||
      die "Không mở được Docker Desktop. Hãy mở Docker rồi chạy lại."
    local attempts=60
    while [ "$attempts" -gt 0 ]; do
      docker info >/dev/null 2>&1 && return
      attempts=$((attempts - 1))
      sleep 2
    done
  fi

  die "Docker daemon chưa chạy. Khởi động Docker rồi chạy lại ./run.sh."
}

ensure_uv() {
  if command_exists uv; then
    UV_BIN="$(command -v uv)"
    return
  fi
  if [ -x "$TOOLS_DIR/uv" ]; then
    UV_BIN="$TOOLS_DIR/uv"
    ok "uv đã có trong cache dự án — bỏ qua tải."
    return
  fi

  command_exists curl || die "Cần curl để tự cài uv."
  mkdir -p "$TOOLS_DIR"
  info "Chưa có uv; đang cài cục bộ vào .tools/bin (chỉ lần đầu)..."
  curl -LsSf https://astral.sh/uv/install.sh |
    env UV_UNMANAGED_INSTALL="$TOOLS_DIR" sh
  [ -x "$TOOLS_DIR/uv" ] || die "Cài uv không thành công."
  UV_BIN="$TOOLS_DIR/uv"
}

ensure_node() {
  command_exists node || die "Chưa có Node.js. Cần Node.js 20.19+ hoặc 22.12+."
  command_exists npm || die "Chưa có npm."

  local major minor
  major="$(node -p 'process.versions.node.split(".")[0]')"
  minor="$(node -p 'process.versions.node.split(".")[1]')"
  if ! { [ "$major" -eq 20 ] && [ "$minor" -ge 19 ]; } &&
    ! { [ "$major" -ge 22 ] &&
      { [ "$major" -gt 22 ] || [ "$minor" -ge 12 ]; }; }; then
    die "Node.js $(node --version) không tương thích Vite. Cần 20.19+ hoặc 22.12+."
  fi
}

sync_backend_dependencies() {
  if (cd "$BACKEND_DIR" && "$UV_BIN" sync --check --locked >/dev/null 2>&1); then
    ok "Backend dependencies đã đủ — bỏ qua tải."
    return
  fi
  info "Đang đồng bộ backend dependencies từ uv.lock..."
  (cd "$BACKEND_DIR" && "$UV_BIN" sync --locked)
}

sync_frontend_dependencies() {
  local modules_lock="$FRONTEND_DIR/node_modules/.package-lock.json"
  if [ -d "$FRONTEND_DIR/node_modules" ] &&
    [ -f "$modules_lock" ] &&
    [ ! "$FRONTEND_DIR/package.json" -nt "$modules_lock" ] &&
    [ ! "$FRONTEND_DIR/package-lock.json" -nt "$modules_lock" ] &&
    (cd "$FRONTEND_DIR" && npm ls --depth=0 >/dev/null 2>&1); then
    ok "Frontend dependencies đã đủ — bỏ qua tải."
    return
  fi
  info "Đang cài frontend dependencies từ package-lock.json..."
  (cd "$FRONTEND_DIR" && npm ci)
}

load_env() {
  if [ ! -f "$ROOT_DIR/.env" ]; then
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    ok "Đã tạo .env từ .env.example."
  fi

  # Parse KEY=VALUE as data instead of sourcing arbitrary shell code. This also
  # keeps characters such as $ in API keys intact.
  local line key value
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if { [[ "$value" == \"*\" ]] && [[ "$value" == *\" ]]; } ||
      { [[ "$value" == \'*\' ]] && [[ "$value" == *\' ]]; }; then
      value="${value:1:${#value}-2}"
    fi
    export "$key=$value"
  done <"$ROOT_DIR/.env"

  export DATABASE_URL="${DATABASE_URL:-$DEFAULT_DATABASE_URL}"
  export THIRD_PARTY_MODE="${THIRD_PARTY_MODE:-mock}"
  export DEV_SKIP_AUTH="${DEV_SKIP_AUTH:-0}"
}

start_database() {
  if (
    cd "$BACKEND_DIR"
    "$UV_BIN" run --no-sync python -c \
      "import os, psycopg2; psycopg2.connect(os.environ['DATABASE_URL'], connect_timeout=2).close()"
  ) >/dev/null 2>&1; then
    ok "Postgres đã chạy — không tạo container trùng."
    return
  fi

  if [ "$DATABASE_URL" != "$DEFAULT_DATABASE_URL" ]; then
    die "Không kết nối được DATABASE_URL tùy chỉnh: $DATABASE_URL"
  fi

  ensure_docker
  info "Đảm bảo Postgres đang chạy (image/container đã có sẽ được tái sử dụng)..."
  (cd "$ROOT_DIR" && docker compose up -d db)

  local attempts=30
  while [ "$attempts" -gt 0 ]; do
    if (cd "$ROOT_DIR" && docker compose exec -T db pg_isready -U shb -d shb >/dev/null 2>&1); then
      ok "Postgres sẵn sàng."
      return
    fi
    attempts=$((attempts - 1))
    sleep 1
  done
  die "Postgres không sẵn sàng. Xem log bằng: docker compose logs db"
}

prepare_database() {
  info "Áp dụng migration còn thiếu..."
  (cd "$BACKEND_DIR" && "$UV_BIN" run --no-sync alembic upgrade head)
  (
    cd "$ROOT_DIR"
    PYTHONPATH="$BACKEND_DIR:$ROOT_DIR" \
      "$UV_BIN" run --project "$BACKEND_DIR" --no-sync python scripts/bootstrap_db.py
  )
}

start_backend() {
  if backend_is_ready; then
    ok "Backend đã chạy tại $BACKEND_URL — không tạo process trùng."
    return
  fi
  info "Khởi động backend tại $BACKEND_URL..."
  (
    cd "$BACKEND_DIR"
    exec env \
      DATABASE_URL="$DATABASE_URL" \
      THIRD_PARTY_MODE="$THIRD_PARTY_MODE" \
      DEV_SKIP_AUTH="$DEV_SKIP_AUTH" \
      "$UV_BIN" run --no-sync uvicorn app.main:app \
      --host 0.0.0.0 --port 8000 --reload
  ) &
  BACKEND_PID=$!
  wait_for_url "Backend" "$BACKEND_PID" backend_is_ready
  ok "Backend sẵn sàng."
}

start_frontend() {
  if frontend_is_ready; then
    ok "Frontend đã chạy tại $FRONTEND_URL — không tạo process trùng."
    return
  fi
  info "Khởi động frontend tại $FRONTEND_URL..."
  (
    cd "$FRONTEND_DIR"
    exec env VITE_USE_MOCK_API=false \
      "$FRONTEND_DIR/node_modules/.bin/vite" --host 0.0.0.0
  ) &
  FRONTEND_PID=$!
  wait_for_url "Frontend" "$FRONTEND_PID" frontend_is_ready
  ok "Frontend sẵn sàng."
}

main() {
  command_exists curl || die "Cần curl để health-check dịch vụ."

  if backend_is_ready && frontend_is_ready; then
    ok "Dự án đã chạy — bỏ qua toàn bộ bước khởi động."
    printf '\n  UI:  %s\n  API: %s/docs\n\n' "$FRONTEND_URL" "$BACKEND_URL"
    return
  fi

  load_env
  ensure_uv
  ensure_node
  sync_backend_dependencies
  sync_frontend_dependencies
  start_database
  prepare_database

  trap cleanup EXIT INT TERM
  start_backend
  start_frontend

  printf '\n\033[1;32mHệ thống hỗ trợ thẩm định tín dụng SHB đã chạy.\033[0m\n'
  printf '  UI:       %s\n' "$FRONTEND_URL"
  printf '  API docs: %s/docs\n' "$BACKEND_URL"
  printf '  Dừng:     Ctrl+C (Postgres vẫn được giữ để lần sau chạy nhanh)\n\n'

  if [ -z "$BACKEND_PID" ] && [ -z "$FRONTEND_PID" ]; then
    ok "API và UI đã chạy từ trước — launcher không tạo process trùng."
    return
  fi

  while :; do
    if [ -n "$BACKEND_PID" ] && ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      wait "$BACKEND_PID" || true
      die "Backend đã dừng."
    fi
    if [ -n "$FRONTEND_PID" ] && ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
      wait "$FRONTEND_PID" || true
      die "Frontend đã dừng."
    fi
    sleep 2
  done
}

main "$@"
