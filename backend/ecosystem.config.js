// PM2 Ecosystem Config — Shero Backend Usage: pm2 start ecosystem.config.js --env production
module.exports = {
  apps: [
    {
      name:           'shero-backend',
      script:         'dist/index.js',
      instances:      1,
      exec_mode:      'cluster',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      out_file:  './logs/out.log',
      error_file:'./logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_restarts:  10,
      min_uptime:    '5s',
      watch:         false,
      max_memory_restart: '512M',
    },
  ],
};
