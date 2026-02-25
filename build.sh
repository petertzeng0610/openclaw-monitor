#!/bin/bash
# OpenClaw Monitor Docker Build Script
# ======================================
# This script builds the Docker image for OpenClaw Monitor

set -e

IMAGE_NAME="openclaw/monitor"
IMAGE_TAG="latest"
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"

echo "=========================================="
echo "  OpenClaw Monitor Docker Builder"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    echo ""
    echo "Please install Docker first:"
    echo "  - macOS: https://docs.docker.com/desktop/mac/install/"
    echo "  - Linux: https://docs.docker.com/engine/install/"
    exit 1
fi

echo "📦 Building Docker image: $FULL_IMAGE_NAME"
echo ""

# Build the image
docker build -t "$FULL_IMAGE_NAME" .

echo ""
echo "✅ Build completed successfully!"
echo ""
echo "To run the container:"
echo "  docker-compose up -d"
echo ""
echo "Or using docker run:"
echo "  docker run -d \\"
echo "    -p 3847:3847 \\"
echo "    -v ~/.openclaw:/home/openclaw/.openclaw:ro \\"
echo "    --name openclaw-monitor \\"
echo "    $FULL_IMAGE_NAME"
echo ""
echo "Then access the dashboard at: http://localhost:3847"
echo ""
