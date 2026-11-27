#!/usr/bin/env bash
# Cài đặt / cập nhật app phanhieu trên VPS Ubuntu/Debian bằng PM2 (không Docker).
# Chạy bằng root:   sudo bash vps-setup.sh
# Chạy lại bất cứ lúc nào để cập nhật code mới nhất — dữ liệu được giữ nguyên.
#
# Tuỳ chọn (đặt trước lệnh):
#   BRANCH=main                   nhánh code cần deploy
#   APP_DIR=/opt/phanhieu-app     thư mục cài đặt
#   APP_PORT=3005                 cổng cho LẦN CÀI ĐẦU (bỏ trống: tự chọn cổng trống)
#   SET_APP_PORT=3003             đổi cổng của bản đã cài (ghi vào .env)
#   SET_APP_URL=https://ten.mien  đổi địa chỉ công khai của app (ghi vào .env)
#   REPLACE_PM2=phanhieu          tắt & xoá tiến trình PM2 cũ tên này rồi chạy bản
#                                 mới thay chỗ (chỉ khi cả hai dùng CÙNG database)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/phamvinh123-git/phanhieu-app.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/phanhieu-app}"
APP_PORT="${APP_PORT:-}"
SET_APP_PORT="${SET_APP_PORT:-}"
SET_APP_URL="${SET_APP_URL:-}"
REPLACE_PM2="${REPLACE_PM2:-}"
PM2_NAME=phanhieu-app

# Cổng $1 đang có tiến trình lắng nghe?
port_in_use() { ss -ltnH "sport = :$1" 2>/dev/null | grep -q .; }
# Thư mục làm việc của tiến trình đang chiếm cổng $1 (rỗng nếu không có)
port_owner_cwd() {
  local pid
  pid=$(ss -ltnpH "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
  [ -n "$pid" ] && readlink "/proc/$pid/cwd" 2>/dev/null || true
}
# Thư mục chạy của tiến trình PM2 tên $1
pm2_cwd() {
  pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s||"[]").find(p=>p.name===process.argv[1]);process.stdout.write(a?a.pm2_env.pm_cwd:"")})' "$1"
}
# "máy:cổng/tên-db" trong một DATABASE_URL (bỏ tài khoản/mật khẩu)
db_target() { printf '%s' "$1" | sed -E 's#^[a-z]+://([^@]*@)?##; s#\?.*$##; s#localhost#127.0.0.1#'; }
# Ghi/đổi một biến trong .env
set_env() { if grep -q "^$1=" .env; then sed -i "s#^$1=.*#$1=$2#" .env; else echo "$1=$2" >> .env; fi; }
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
  # Không bao giờ đụng vào database / tài khoản database đã có sẵn (có thể là
  # của bản cài khác) — dừng lại để người quản trị tự cấu hình DATABASE_URL.
  if su - postgres -c "psql -qAtc \"select 1 from pg_roles where rolname='${DB_USER}'\"" | grep -q 1 ||
     su - postgres -c "psql -qAtc \"select 1 from pg_database where datname='${DB_NAME}'\"" | grep -q 1; then
    echo "!! Database '${DB_NAME}' hoặc tài khoản '${DB_USER}' đã tồn tại trên máy này."
    echo "   Không tự tạo/đổi mật khẩu để tránh ảnh hưởng bản cài khác."
    echo "   Hãy tạo $APP_DIR/.env với DATABASE_URL đúng rồi chạy lại script."
    exit 1
  fi
  if [ -z "$APP_PORT" ]; then
    for p in $(seq 3005 3099); do port_in_use "$p" || { APP_PORT=$p; break; }; done
  elif port_in_use "$APP_PORT"; then
    echo "!! Cổng $APP_PORT đang được ứng dụng khác dùng ($(port_owner_cwd "$APP_PORT")). Chọn cổng khác."
    exit 1
  fi
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
  su - postgres -c "psql -qc \"create role ${DB_USER} with login password '${DB_PASS}'\""
  su - postgres -c "createdb -O ${DB_USER} ${DB_NAME}"
fi
[ -n "$SET_APP_PORT" ] && set_env APP_PORT "$SET_APP_PORT"
[ -n "$SET_APP_URL" ] && set_env APP_URL "$SET_APP_URL"
set -a; . ./.env; set +a

# Tiến trình PM2 cũ cần thay thế: chỉ cho phép khi nó dùng CÙNG database.
OLD_CWD=""
if [ -n "$REPLACE_PM2" ]; then
  OLD_CWD=$(pm2_cwd "$REPLACE_PM2")
  [ -n "$OLD_CWD" ] || { echo "!! Không tìm thấy tiến trình PM2 '$REPLACE_PM2'."; exit 1; }
  OLD_DB=$(grep -h '^DATABASE_URL=' "$OLD_CWD/.env" "$OLD_CWD/.env.production" "$OLD_CWD/.env.local" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'"'' || true)
  if [ -z "$OLD_DB" ]; then
    echo "!! Không đọc được DATABASE_URL của bản cũ ($OLD_CWD). Dừng để tránh mất dữ liệu."; exit 1
  fi
  if [ "$(db_target "$OLD_DB")" != "$(db_target "$DATABASE_URL")" ]; then
    echo "!! Bản cũ dùng database $(db_target "$OLD_DB"), bản mới dùng $(db_target "$DATABASE_URL")."
    echo "   Khác nhau → dừng để tránh mất dữ liệu. Cần chuyển dữ liệu trước."; exit 1
  fi
  echo ">> Bản cũ '$REPLACE_PM2' ($OLD_CWD) dùng cùng database $(db_target "$DATABASE_URL") — sẽ thay thế."
fi

# Cổng phải trống, hoặc đang do chính app này / tiến trình được thay thế chiếm.
OWNER=$(port_owner_cwd "$APP_PORT")
if [ -n "$OWNER" ] && [ "$OWNER" != "$APP_DIR" ] && [ "$OWNER" != "$OLD_CWD" ]; then
  echo "!! Cổng $APP_PORT đang được ứng dụng khác dùng ($OWNER). Đổi bằng SET_APP_PORT=<cổng trống>."
  exit 1
fi

# Sao lưu database trước khi cập nhật (giữ 14 bản gần nhất)
if command -v pg_dump >/dev/null 2>&1; then
  mkdir -p /root/backups/phanhieu
  pg_dump -Fc "$DATABASE_URL" > "/root/backups/phanhieu/phanhieu-$(date +%Y%m%d-%H%M%S).dump" \
    && echo ">> Đã sao lưu database vào /root/backups/phanhieu" \
    || echo "!! Không sao lưu được database (vẫn tiếp tục)."
  ls -1t /root/backups/phanhieu/*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
fi

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
if [ -n "$REPLACE_PM2" ]; then
  echo ">> Tắt bản cũ '$REPLACE_PM2'..."
  pm2 delete "$REPLACE_PM2"
fi
# Xoá rồi chạy lại để luôn áp dụng đúng cổng/biến môi trường mới nhất.
pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# ------------------------- 6. Nhắc hạn công việc 08:00 hằng ngày (giờ VN)
cat > /etc/cron.d/phanhieu-due-date-reminders <<CRON
CRON_TZ=Asia/Ho_Chi_Minh
0 8 * * * root curl -fsS -X POST http://127.0.0.1:${APP_PORT}/api/cron/due-date-reminders -H 'Authorization: Bearer ${CRON_SECRET}' >/dev/null 2>&1
CRON
chmod 644 /etc/cron.d/phanhieu-due-date-reminders

# ------------------------------------------------------------- 7. Kiểm tra
# Phải là CHÍNH app này trả lời (trang đăng nhập có chữ TaskFlow) và PM2 báo online.
echo -n ">> Chờ app khởi động"
OK=0
for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${APP_PORT}/login" 2>/dev/null | grep -qi "taskflow" &&
     [ "$(port_owner_cwd "$APP_PORT")" = "$APP_DIR" ]; then OK=1; echo " OK"; break; fi
  echo -n "."; sleep 2
done
if [ "$OK" != 1 ]; then
  echo; echo "!! App chưa chạy được trên cổng ${APP_PORT}. Log gần nhất:"
  pm2 logs "$PM2_NAME" --lines 30 --nostream || true
  exit 1
fi

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
