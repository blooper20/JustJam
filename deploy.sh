#!/bin/bash

# JustJam Backend One-Click Deployment Script for Ubuntu 22.04 (AWS EC2)

echo "🚀 Starting JustJam Backend Deployment..."

# 1. System Update & Docker Installation
echo "📦 Installing Docker and dependencies..."
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release git nginx certbot python3-certbot-nginx

if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
fi

if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# 2. Setup Environment Variables
echo "⚙️ Setting up .env file..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "⚠️ .env file created from template. PLEASE UPDATE it with strong passwords and production URLs!"
    echo "   Required updates: JWT_SECRET_KEY, DATABASE_URL password, ALLOWED_ORIGINS"
fi

# 3. Verify docker-compose.prod.yml exists
echo "📝 Verifying production docker-compose configuration..."
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "❌ docker-compose.prod.yml not found. Please ensure you are running this from the repository root."
    exit 1
fi
echo "✅ docker-compose.prod.yml verified."


# 4. Run Docker Compose
echo "🐳 Starting Docker containers..."
sudo docker-compose -f docker-compose.prod.yml up -d --build

echo ""
echo "✅ Backend deployed successfully! Containers are running in the background."
echo "👉 Next steps:"
echo "1. Edit the .env file with your production secrets."
echo "2. Restart the containers: sudo docker-compose -f docker-compose.prod.yml restart"
echo "3. Configure Nginx and SSL using certbot (e.g., sudo certbot --nginx -d api.yourdomain.com)"
