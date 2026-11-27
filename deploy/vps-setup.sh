#!/usr/bin/env bash
# Cài đặt / cập nhật app phanhieu trên VPS Ubuntu/Debian bằng PM2 (không Docker).
# Chạy bằng root:   sudo bash vps-setup.sh
# Chạy lại bất cứ lúc nào để cập nhật code mới nhất — dữ liệu được giữ nguyên.
#
# Tuỳ chọn (đặt trước lệnh):  BRANCH=main  APP_PORT=3000  APP_DIR=/opt/phanhieu-app
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/phamvinh123-git/phanhieu-app.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/phanhieu-app}"
APP_PORT="${APP_PORT:-3000}"
DB_NAME=phanhieu
DB_USER=phanhieu

if [ "$(id -u)" -ne 0 ]; then echo "Hãy chạy bằng root: sudo bash $0"; exit 1; fi
export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------- 1. Phần mềm
need_apt_update=1
apt_install() {
  if [ "$need_apt_update" = 1 ]; then apt-get update -y; need_apt_update=0; fi
  apt-get install -y "$@"
}
command -v git >/dev/null 2>&1 || apt_install git
command -v curl >/dev/null 2>&1 || apt_install curl
command -v openssl >/dev/null 2>&1 || apt_install openssl

NODE_MAJOR=$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0)
if [ "${NODE_MAJOR:-0}" -lt 20 ]; then
  echo ">> Cài Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt_install nodejs
fi
command -v pm2 >/dev/null 2>&1 || { echo ">> Cài PM2..."; npm install -g pm2; }

if ! command -v psql >/dev/null 2>&1; then
  echo ">> Cài PostgreSQL..."
  apt_install postgresql
fi
# Bật PostgreSQL (systemd nếu có, không thì dùng service)
systemctl enable --now postgresql >/dev/null 2>&1 || service postgresql start >/dev/null 2>&1 || true
for _ in $(seq 1 20); do su - postgres -c "psql -qAtc 'select 1'" >/dev/null 2>&1 && break; sleep 1; done

# ---------------------------------------------------------------- 2. Mã nguồn
if [ -d "$APP_DIR/.git" ]; then
  echo ">> Cập nhật mã nguồn (nhánh $BRANCH)..."
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
else
  echo ">> Tải mã nguồn (nhánh $BRANCH)..."
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# ------------------------------------------------- 3. Database + file .env
NEW_ENV=0
if [ ! -f .env ]; then
  NEW_ENV=1
  rnd() { openssl rand -hex "$1"; }
  DB_PASS=$(rnd 16)
  SERVER_IP="$(curl -fsS --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')"
  cat > .env <<ENV
APP_PORT=${APP_PORT}
APP_URL=http://${SERVER_IP}:${APP_PORT}
DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}
JWT_SECRET=$(rnd 32)
CRON_SECRET=$(rnd 24)
BOOTSTRAP_SEED_SECRET=$(rnd 24)
# Mật khẩu chung cho mọi tài khoản lúc khởi tạo; mỗi người tự đổi sau lần đăng nhập đầu.
SEED_DEFAULT_PASSWORD=Phanhieu@$(date +%Y)
# Gửi email (tuỳ chọn) — điền rồi chạy:  pm2 restart phanhieu-app --update-env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
ENV
  chmod 600 .env

  echo ">> Tạo database '${DB_NAME}'..."
  if su - postgres -c "psql -qAtc \"select 1 from pg_roles where rolname='${DB_USER}'\"" | grep -q 1; then
    su - postgres -c "psql -qc \"alter role ${DB_USER} with login password '${DB_PASS}'\""
  else
    su - postgres -c "psql -qc \"create role ${DB_USER} with login password '${DB_PASS}'\""
  fi
  if ! su - postgres -c "psql -qAtc \"select 1 from pg_database where datname='${DB_NAME}'\"" | grep -q 1; then
    su - postgres -c "createdb -O ${DB_USER} ${DB_NAME}"
  fi
fi
set -a; . ./.env; set +a

# ---------------------------------------------------- 4. Build + dữ liệu
echo ">> Cài thư viện và build (lần đầu mất vài phút)..."
npm ci --no-audit --no-fund
npm run build
echo ">> Đồng bộ cấu trúc bảng..."
npx drizzle-kit push
echo ">> Khởi tạo dữ liệu nếu database còn trống..."
npx tsx src/db/seed.ts
rm -f credentials.generated.csv

# ---------------------------------------------------------- 5. Chạy bằng PM2
if pm2 describe phanhieu-app >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# ------------------------- 6. Nhắc hạn công việc 08:00 hằng ngày (giờ VN)
cat > /etc/cron.d/phanhieu-due-date-reminders <<CRON
CRON_TZ=Asia/Ho_Chi_Minh
0 8 * * * root curl -fsS -X POST http://127.0.0.1:${APP_PORT}/api/cron/due-date-reminders -H 'Authorization: Bearer ${CRON_SECRET}' >/dev/null 2>&1
CRON
chmod 644 /etc/cron.d/phanhieu-due-date-reminders

# ------------------------------------------------------------- 7. Kiểm tra
echo -n ">> Chờ app khởi động"
OK=0
for _ in $(seq 1 40); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${APP_PORT}/login"; then OK=1; echo " OK"; break; fi
  echo -n "."; sleep 2
done
[ "$OK" = 1 ] || { echo; echo "!! App chưa phản hồi. Xem log: pm2 logs phanhieu-app"; exit 1; }

echo
echo "================================================================"
echo " App đang chạy tại: ${APP_URL}"
if [ "$NEW_ENV" = 1 ]; then
  echo " Tài khoản quản trị: admin@hmu.edu.vn"
  echo " Mật khẩu chung ban đầu (mọi tài khoản): ${SEED_DEFAULT_PASSWORD}"
  echo " -> Đăng nhập xong hãy đổi mật khẩu ngay."
fi
echo " Xem log:    pm2 logs phanhieu-app"
echo " Sao lưu:    sudo -u postgres pg_dump -Fc ${DB_NAME} > ~/phanhieu-\$(date +%F).dump"
echo " Cập nhật:   sudo bash ${APP_DIR}/deploy/vps-setup.sh"
echo "================================================================"
