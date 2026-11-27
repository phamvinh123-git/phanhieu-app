// Cấu hình PM2 cho VPS:  pm2 start ecosystem.config.cjs
// Biến môi trường (DATABASE_URL, JWT_SECRET...) đọc từ file .env cạnh file này.
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const file = path.join(__dirname, ".env");
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();

module.exports = {
  apps: [
    {
      name: "phanhieu-app",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: `start -H 0.0.0.0 -p ${env.APP_PORT || 3000}`,
      env: { ...env, NODE_ENV: "production" },
      exec_mode: "fork", // tiến trình next-server giữ cổng trực tiếp (như các app khác trên VPS)
      instances: 1,
      autorestart: true,
      max_memory_restart: "700M",
      time: true,
    },
  ],
};
