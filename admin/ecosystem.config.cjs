// pm2 process file. The app reads its own .env next to server.js; nothing secret lives here.
module.exports = {
  apps: [
    {
      name: 'masellas-admin',
      script: 'server.js',
      cwd: __dirname,
      env: { NODE_ENV: 'production' },
      instances: 1, // in-memory rate limiter and write queue assume a single process
      exec_mode: 'fork',
      max_memory_restart: '150M',
      exp_backoff_restart_delay: 200, // 200 ms, doubling up to 15 s while it keeps crashing
      max_restarts: 20,
      min_uptime: '10s',
      kill_timeout: 5000,
      time: true,
    },
  ],
};
