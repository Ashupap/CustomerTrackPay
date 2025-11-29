#!/bin/bash

# ============================================
# PayTrack Database Reset Script
# WARNING: This will DELETE all data!
# ============================================

set -e

APP_DIR="/var/www/paytrack"
DB_FILE="${APP_DIR}/paytrack.db"
BACKUP_DIR="/var/backups/paytrack"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}============================================${NC}"
echo -e "${RED}   PayTrack Database Reset${NC}"
echo -e "${RED}   WARNING: This will DELETE ALL DATA!${NC}"
echo -e "${RED}============================================${NC}"
echo ""

# Check if running as correct user
if [ ! -w "${APP_DIR}" ]; then
    echo -e "${RED}Error: Cannot write to ${APP_DIR}${NC}"
    echo "Run with appropriate permissions or as root"
    exit 1
fi

# Confirm reset
echo -e "${YELLOW}Are you sure you want to reset the database?${NC}"
echo "This will delete all customers, purchases, payments, and users."
echo ""
read -p "Type 'RESET' to confirm: " confirm

if [ "$confirm" != "RESET" ]; then
    echo "Reset cancelled."
    exit 0
fi

# Create backup before reset
if [ -f "$DB_FILE" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    mkdir -p $BACKUP_DIR
    
    echo -e "${GREEN}Creating backup before reset...${NC}"
    cp "$DB_FILE" "$BACKUP_DIR/paytrack_pre_reset_${TIMESTAMP}.db"
    echo "Backup saved to: $BACKUP_DIR/paytrack_pre_reset_${TIMESTAMP}.db"
fi

# Stop the application
echo -e "${GREEN}Stopping application...${NC}"
pm2 stop paytrack 2>/dev/null || true

# Delete the database file
echo -e "${GREEN}Removing database...${NC}"
rm -f "$DB_FILE"
rm -f "${DB_FILE}-shm"
rm -f "${DB_FILE}-wal"

# Start the application (it will recreate the database)
echo -e "${GREEN}Starting application (database will be recreated)...${NC}"
pm2 start paytrack

# Wait for database initialization
sleep 3

# Verify database was created
if [ -f "$DB_FILE" ]; then
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}   Database Reset Complete!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo "Default admin account created:"
    echo "  Username: admin"
    echo "  Password: admin123"
    echo ""
    echo -e "${YELLOW}Remember to change the admin password!${NC}"
else
    echo -e "${RED}Warning: Database file not found. Check application logs.${NC}"
    pm2 logs paytrack --lines 20
fi
