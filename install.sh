#!/bin/bash
# OpenClaw Monitor - One-Click Install Script
# ============================================
# This script installs Docker (if needed) and sets up OpenClaw Monitor

set -e

echo "=========================================="
echo "  OpenClaw Monitor - Installer"
echo "=========================================="
echo ""

# Check if running on macOS or Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
else
    echo "❌ This script only supports macOS and Linux"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "📥 Docker not found. Installing Docker..."
    
    if [ "$OS" == "macos" ]; then
        echo "Please download Docker Desktop for Mac:"
        echo "  https://www.docker.com/products/docker-desktop"
        echo ""
        echo "After installation, run this script again."
        exit 1
    else
        # Try to install Docker on Linux
        echo "Attempting to install Docker..."
        curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
        sudo sh /tmp/get-docker.sh
        sudo usermod -aG docker $USER
        echo "Docker installed. You may need to log out and back in."
    fi
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if .env file exists, create from example if not
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "📝 Created .env file from template"
    fi
fi

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t openclaw/monitor:latest .

# Check if a container is already running
if docker ps -a --format '{{.Names}}' | grep -q "^openclaw-monitor$"; then
    echo "♻️  Removing old container..."
    docker rm -f openclaw-monitor
fi

# Run the container
echo "🚀 Starting OpenClaw Monitor..."
docker run -d \
    --name openclaw-monitor \
    -p 3847:3847 \
    -v ~/.openclaw:/home/openclaw/.openclaw:ro \
    -e NODE_ENV=production \
    openclaw/monitor:latest

echo ""
echo "✅ OpenClaw Monitor is now running!"
echo ""
echo "📊 Access the dashboard at: http://localhost:3847"
echo ""
echo "Useful commands:"
echo "  docker logs openclaw-monitor    # View logs"
echo "  docker stop openclaw-monitor    # Stop the monitor"
echo "  docker restart openclaw-monitor # Restart the monitor"
echo ""
