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
    },
  ],
};
