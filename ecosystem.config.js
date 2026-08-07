module.exports = {
  apps: [
    {
      name: 'maria-api',
      script: 'npm',
      args: 'start',
      cwd: './apps/api',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      shell: true,
      // Explicitly capture stdout/stderr for proper PM2 log collection
      out_file: './logs/api-out.log',
      error_file: './logs/api-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'maria',
      script: 'npm',
      args: 'start',
      cwd: './apps/web',
      instances: 1,
      autorestart: true,
      restart_delay: 2000,
      shell: true,
      out_file: './logs/web-out.log',
      error_file: './logs/web-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
