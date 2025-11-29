#!/bin/bash

# PayTrack Deployment Script
# Run this script after initial server setup to deploy or update the application

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
APP_DIR="/var/www/paytrack"
APP_NAME="paytrack"

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse arguments
ACTION=${1:-"deploy"}
DOMAIN=${2:-""}

case $ACTION in
    deploy|update)
        print_status "Starting deployment..."
        ;;
    setup-ssl)
        if [ -z "$DOMAIN" ]; then
            print_error "Domain required for SSL setup. Usage: ./deploy.sh setup-ssl your-domain.com"
            exit 1
        fi
        ;;
    backup)
        ;;
    *)
        echo "Usage: $0 {deploy|update|setup-ssl|backup} [domain]"
        exit 1
        ;;
esac

# ==========================================
# Deploy/Update Application
# ==========================================
if [ "$ACTION" = "deploy" ] || [ "$ACTION" = "update" ]; then
    cd $APP_DIR
    
    print_status "Installing dependencies..."
    npm install --production
    
    print_status "Building application..."
    npm run build
    
    # Check if .env exists
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Creating template..."
        cat > .env << EOF
NODE_ENV=production
PORT=5000
SESSION_SECRET=$(openssl rand -hex 64)
EOF
        print_status "Created .env with generated SESSION_SECRET"
        print_warning "Review and update .env file as needed"
    fi
    
    # Create data directory if not exists
    mkdir -p data
    
    # Check if PM2 process exists
    if pm2 describe $APP_NAME > /dev/null 2>&1; then
        print_status "Reloading application (zero-downtime)..."
        pm2 reload $APP_NAME
    else
        print_status "Starting application with PM2..."
        if [ -f "ecosystem.config.cjs" ]; then
            pm2 start ecosystem.config.cjs
        else
            pm2 start dist/index.js --name $APP_NAME
        fi
        pm2 save
    fi
    
    print_status "Deployment complete!"
    pm2 status
fi

# ==========================================
# Setup SSL
# ==========================================
if [ "$ACTION" = "setup-ssl" ]; then
    print_status "Setting up SSL for $DOMAIN..."
    
    # Update nginx config with domain
    if [ -f "/etc/nginx/sites-available/paytrack" ]; then
        sudo sed -i "s/your-domain.com/$DOMAIN/g" /etc/nginx/sites-available/paytrack
        sudo nginx -t && sudo systemctl reload nginx
    fi
    
    # Get SSL certificate
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN
    
    print_status "SSL setup complete!"
fi

# ==========================================
# Backup Database
# ==========================================
if [ "$ACTION" = "backup" ]; then
    BACKUP_DIR="/var/backups/paytrack"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    
    mkdir -p $BACKUP_DIR
    
    if [ -f "$APP_DIR/paytrack.db" ]; then
        print_status "Backing up database..."
        cp "$APP_DIR/paytrack.db" "$BACKUP_DIR/paytrack_${TIMESTAMP}.db"
        
        # Keep only last 7 backups
        ls -t $BACKUP_DIR/paytrack_*.db | tail -n +8 | xargs -r rm
        
        print_status "Backup saved to $BACKUP_DIR/paytrack_${TIMESTAMP}.db"
        ls -la $BACKUP_DIR
    else
        print_error "Database file not found at $APP_DIR/paytrack.db"
        exit 1
    fi
fi

echo ""
print_status "Done!"
