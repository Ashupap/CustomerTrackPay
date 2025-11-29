#!/bin/bash

# PayTrack Ubuntu Server Deployment Script
# This script sets up a fresh Ubuntu server (22.04/24.04) for PayTrack deployment

set -e

echo "=========================================="
echo "PayTrack Deployment Script"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration - Modify these for your setup
APP_NAME="paytrack"
APP_DIR="/var/www/${APP_NAME}"
DOMAIN=""
NODE_VERSION="20"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

# ==========================================
# 1. System Update
# ==========================================
print_status "Updating system packages..."
apt update && apt upgrade -y

# ==========================================
# 2. Install Node.js
# ==========================================
print_status "Installing Node.js ${NODE_VERSION}..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
else
    print_warning "Node.js already installed: $(node -v)"
fi

# Verify Node.js installation
print_status "Node.js version: $(node -v)"
print_status "npm version: $(npm -v)"

# ==========================================
# 3. Install PM2
# ==========================================
print_status "Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2@latest
else
    print_warning "PM2 already installed: $(pm2 -v)"
fi

# ==========================================
# 4. Install Nginx
# ==========================================
print_status "Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    apt install -y nginx
    systemctl start nginx
    systemctl enable nginx
else
    print_warning "Nginx already installed"
fi

# ==========================================
# 5. Install SQLite3
# ==========================================
print_status "Installing SQLite3..."
apt install -y sqlite3

# ==========================================
# 6. Install Build Tools (for native modules)
# ==========================================
print_status "Installing build tools..."
apt install -y build-essential python3

# ==========================================
# 7. Create Application Directory
# ==========================================
print_status "Creating application directory..."
mkdir -p ${APP_DIR}
mkdir -p /var/log/pm2

# ==========================================
# 8. Configure Firewall
# ==========================================
print_status "Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow OpenSSH
    ufw allow 'Nginx Full'
    ufw --force enable
fi

# ==========================================
# 9. Install Certbot (for SSL)
# ==========================================
print_status "Installing Certbot for SSL certificates..."
apt install -y certbot python3-certbot-nginx

# ==========================================
# 10. Install PM2 Log Rotate
# ==========================================
print_status "Installing PM2 log rotation..."
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# ==========================================
# Summary
# ==========================================
echo ""
echo "=========================================="
echo -e "${GREEN}Installation Complete!${NC}"
echo "=========================================="
echo ""
echo "Installed components:"
echo "  - Node.js $(node -v)"
echo "  - npm $(npm -v)"
echo "  - PM2 $(pm2 -v)"
echo "  - Nginx $(nginx -v 2>&1 | head -1)"
echo "  - SQLite3"
echo "  - Certbot"
echo ""
echo "Application directory: ${APP_DIR}"
echo ""
echo "Next steps:"
echo "  1. Copy your application files to ${APP_DIR}"
echo "  2. Run 'cd ${APP_DIR} && npm install --production'"
echo "  3. Create .env file with your environment variables"
echo "  4. Configure Nginx (use nginx.conf template)"
echo "  5. Start application with PM2"
echo ""
echo "See deploy/README.md for detailed instructions."
