# PayTrack Ubuntu Server Deployment Guide

This guide walks you through deploying PayTrack on an Ubuntu server (22.04/24.04 LTS).

## Prerequisites

- Ubuntu 22.04 or 24.04 LTS server
- Root or sudo access
- Domain name (optional, for SSL)
- At least 1GB RAM, 10GB disk space

## Quick Start

### 1. Server Setup

SSH into your server and run the installation script:

```bash
# Download and run the install script
curl -O https://raw.githubusercontent.com/your-repo/paytrack/main/deploy/install.sh
chmod +x install.sh
sudo ./install.sh
```

Or manually:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2@latest

# Install Nginx and SQLite
sudo apt install -y nginx sqlite3 build-essential

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Deploy Application

```bash
# Create application directory
sudo mkdir -p /var/www/paytrack
sudo chown $USER:$USER /var/www/paytrack
cd /var/www/paytrack

# Clone or copy your application
git clone https://github.com/your-username/paytrack.git .

# Install dependencies
npm install --production

# Build the application
npm run build
```

### 3. Configure Environment Variables

Create the environment file:

```bash
sudo nano /var/www/paytrack/.env
```

Add the following (adjust values as needed):

```env
NODE_ENV=production
PORT=5000
SESSION_SECRET=your-very-long-random-secret-key-here
DATABASE_URL=file:./data/paytrack.db
```

Generate a secure session secret:
```bash
openssl rand -hex 64
```

### 4. Create Data Directory

```bash
mkdir -p /var/www/paytrack/data
chmod 755 /var/www/paytrack/data
```

### 5. Configure PM2

Copy the ecosystem config:

```bash
cp deploy/ecosystem.config.cjs /var/www/paytrack/
```

Start the application:

```bash
cd /var/www/paytrack
pm2 start ecosystem.config.cjs

# Save process list for auto-restart
pm2 save

# Generate startup script
pm2 startup systemd
# Run the command that PM2 outputs (as root)
```

### 6. Configure Nginx

```bash
# Copy nginx configuration
sudo cp deploy/nginx.conf /etc/nginx/sites-available/paytrack

# Edit the config and replace 'your-domain.com' with your actual domain
sudo nano /etc/nginx/sites-available/paytrack

# Enable the site
sudo ln -s /etc/nginx/sites-available/paytrack /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

### 7. Setup SSL with Let's Encrypt

```bash
# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### 8. Configure Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Post-Deployment

### Verify Deployment

```bash
# Check PM2 status
pm2 status

# Check application logs
pm2 logs paytrack

# Check nginx status
sudo systemctl status nginx

# Test the application
curl http://localhost:5000
```

### Access the Application

1. Open your browser and navigate to your domain
2. Login with default admin credentials:
   - Username: `admin`
   - Password: `admin123`
3. **Important**: Change the admin password immediately after first login!

## Updating the Application

```bash
cd /var/www/paytrack

# Pull latest changes
git pull origin main

# Install dependencies
npm install --production

# Rebuild
npm run build

# Reload PM2 (zero-downtime)
pm2 reload paytrack
```

## Maintenance Commands

### PM2 Commands
```bash
pm2 status              # Show all processes
pm2 logs paytrack       # View logs
pm2 logs paytrack --lines 100  # Last 100 lines
pm2 restart paytrack    # Restart (with downtime)
pm2 reload paytrack     # Reload (zero-downtime)
pm2 stop paytrack       # Stop application
pm2 delete paytrack     # Remove from PM2
pm2 monit               # Real-time monitoring
```

### Nginx Commands
```bash
sudo nginx -t           # Test configuration
sudo systemctl restart nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/paytrack_error.log
```

### Database Backup
```bash
# Backup SQLite database
cp /var/www/paytrack/data/paytrack.db /backup/paytrack-$(date +%Y%m%d).db

# Or create compressed backup
sqlite3 /var/www/paytrack/data/paytrack.db ".backup '/backup/paytrack.db'"
gzip /backup/paytrack.db
```

## Troubleshooting

### 502 Bad Gateway
1. Check if PM2 is running: `pm2 status`
2. Check PM2 logs: `pm2 logs paytrack`
3. Verify port matches nginx config
4. Check nginx error logs: `sudo tail -f /var/log/nginx/paytrack_error.log`

### Application Won't Start
1. Check logs: `pm2 logs paytrack --lines 200`
2. Verify environment variables: `cat .env`
3. Check database file permissions
4. Try running manually: `NODE_ENV=production node dist/index.js`

### Database Issues
1. Check database file exists: `ls -la data/`
2. Verify permissions: `chmod 755 data/ && chmod 644 data/*.db`
3. Check disk space: `df -h`

### PM2 Not Starting on Boot
```bash
pm2 unstartup
pm2 startup systemd
pm2 save
```

## Security Recommendations

1. **Change default admin password immediately**
2. Keep system updated: `sudo apt update && sudo apt upgrade`
3. Use strong SESSION_SECRET (64+ characters)
4. Enable and configure UFW firewall
5. Use SSL/TLS (Let's Encrypt)
6. Regular database backups
7. Monitor logs for suspicious activity
8. Consider fail2ban for brute force protection:
   ```bash
   sudo apt install fail2ban
   sudo systemctl enable fail2ban
   ```

## Log Files

- PM2 application logs: `/var/log/pm2/`
- Nginx access logs: `/var/log/nginx/paytrack_access.log`
- Nginx error logs: `/var/log/nginx/paytrack_error.log`
- System logs: `/var/log/syslog`

## Support

For issues specific to PayTrack, please check the application logs and ensure all environment variables are correctly configured.
