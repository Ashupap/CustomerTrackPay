#!/bin/bash

# ============================================
# PayTrack Single-Script Deployment
# For Ubuntu Server with Cloudflare Tunnel
# GitHub: https://github.com/Ashupap/CustomerTrackPay
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
APP_NAME="paytrack"
APP_DIR="/var/www/${APP_NAME}"
REPO_URL="https://github.com/Ashupap/CustomerTrackPay.git"
NODE_VERSION="20"
PORT=5000

echo -e "${BLUE}"
echo "============================================"
echo "   PayTrack Deployment Script"
echo "   Ubuntu Server + Cloudflare Tunnel"
echo "============================================"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

# ============================================
# Step 1: System Update
# ============================================
echo -e "${GREEN}[1/8] Updating system packages...${NC}"
apt update && apt upgrade -y

# ============================================
# Step 2: Install Node.js
# ============================================
echo -e "${GREEN}[2/8] Installing Node.js ${NODE_VERSION}...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
fi
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# ============================================
# Step 3: Install PM2
# ============================================
echo -e "${GREEN}[3/8] Installing PM2...${NC}"
npm install -g pm2@latest
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# ============================================
# Step 4: Install Nginx & Build Tools
# ============================================
echo -e "${GREEN}[4/8] Installing Nginx and build tools...${NC}"
apt install -y nginx sqlite3 build-essential python3 git

# ============================================
# Step 5: Clone/Update Repository
# ============================================
echo -e "${GREEN}[5/8] Setting up application...${NC}"
mkdir -p ${APP_DIR}
mkdir -p /var/log/pm2

if [ -d "${APP_DIR}/.git" ]; then
    echo "Updating existing repository..."
    cd ${APP_DIR}
    git fetch origin
    git reset --hard origin/main
else
    echo "Cloning repository..."
    rm -rf ${APP_DIR}/*
    git clone ${REPO_URL} ${APP_DIR}
fi

cd ${APP_DIR}

# ============================================
# Step 6: Install Dependencies & Build
# ============================================
echo -e "${GREEN}[6/8] Installing dependencies and building...${NC}"
npm install
npm run build

# Create data directory for SQLite
mkdir -p ${APP_DIR}/data

# Create .env file if not exists
if [ ! -f "${APP_DIR}/.env" ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    SESSION_SECRET=$(openssl rand -hex 64)
    cat > ${APP_DIR}/.env << EOF
NODE_ENV=production
PORT=${PORT}
SESSION_SECRET=${SESSION_SECRET}
EOF
    echo -e "${GREEN}.env file created with secure SESSION_SECRET${NC}"
fi

# ============================================
# Step 7: Configure PM2
# ============================================
echo -e "${GREEN}[7/8] Configuring PM2...${NC}"

# Create PM2 ecosystem file
cat > ${APP_DIR}/ecosystem.config.cjs << EOF
module.exports = {
  apps: [{
    name: '${APP_NAME}',
    script: 'dist/index.js',
    cwd: '${APP_DIR}',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: ${PORT}
    },
    error_file: '/var/log/pm2/${APP_NAME}-error.log',
    out_file: '/var/log/pm2/${APP_NAME}-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '500M',
    autorestart: true
  }]
};
EOF

# Stop existing process if running
pm2 delete ${APP_NAME} 2>/dev/null || true

# Start application
pm2 start ecosystem.config.cjs
pm2 save

# Setup PM2 startup
pm2 startup systemd -u root --hp /root
pm2 save

# ============================================
# Step 8: Configure Nginx
# ============================================
echo -e "${GREEN}[8/8] Configuring Nginx...${NC}"

cat > /etc/nginx/sites-available/${APP_NAME} << 'EOF'
upstream paytrack_backend {
    server 127.0.0.1:5000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    client_max_body_size 10M;

    location / {
        proxy_pass http://paytrack_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and restart nginx
nginx -t && systemctl restart nginx
systemctl enable nginx

# ============================================
# Configure Firewall (Optional)
# ============================================
if command -v ufw &> /dev/null; then
    echo -e "${YELLOW}Configuring firewall...${NC}"
    ufw allow OpenSSH
    ufw allow 'Nginx HTTP'
    ufw --force enable
fi

# ============================================
# Complete!
# ============================================
echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}   DEPLOYMENT COMPLETE!${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "Application URL: ${GREEN}http://$(hostname -I | awk '{print $1}')${NC}"
echo ""
echo -e "Default Admin Login:"
echo -e "  Username: ${YELLOW}admin${NC}"
echo -e "  Password: ${YELLOW}admin123${NC}"
echo ""
echo -e "${RED}IMPORTANT: Change the admin password after first login!${NC}"
echo ""
echo -e "Useful Commands:"
echo "  pm2 status          - Check app status"
echo "  pm2 logs paytrack   - View app logs"
echo "  pm2 restart paytrack - Restart app"
echo ""
echo -e "To update the app later, run:"
echo "  cd ${APP_DIR} && git pull && npm install && npm run build && pm2 restart paytrack"
echo ""
echo -e "${GREEN}Now configure your Cloudflare Tunnel to point to localhost:80${NC}"
