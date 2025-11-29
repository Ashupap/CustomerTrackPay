// PM2 Ecosystem Configuration for PayTrack
// Copy this file to your application root directory

module.exports = {
  apps: [
    {
      name: 'paytrack',
      script: 'dist/index.js',
      cwd: '/var/www/paytrack',
      instances: 1, // SQLite works best with single instance
      exec_mode: 'fork', // Use 'cluster' for PostgreSQL, 'fork' for SQLite
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      
      // Logging
      error_file: '/var/log/pm2/paytrack-error.log',
      out_file: '/var/log/pm2/paytrack-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      
      // Process management
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 1000,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    }
  ],

  // Deployment configuration (optional - for PM2 deploy)
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server-ip'],
      ref: 'origin/main',
      repo: 'git@github.com:your-username/paytrack.git',
      path: '/var/www/paytrack',
      'pre-deploy-local': '',
      'post-deploy': 'npm install --production && npm run build && pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': '',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};
