#!/bin/bash

# Nova AI Monitor - Local Installer Script
# This script helps users install Nova AI Monitor on their local machine

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Nova AI Monitor - 安裝程式          ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}錯誤: Docker 未安裝${NC}"
    echo "請先安裝 Docker: https://www.docker.com/products/docker-desktop"
    exit 1
fi

echo -e "${GREEN}✓ Docker 已安裝${NC}"

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}錯誤: Docker 未運行${NC}"
    echo "請啟動 Docker Desktop"
    exit 1
fi

echo -e "${GREEN}✓ Docker 正在運行${NC}"

# Create necessary directories
echo ""
echo -e "${YELLOW}建立資料目錄...${NC}"
mkdir -p ~/Library/Application\ Support/NovaAIMonitor
mkdir -p ~/.openclaw
mkdir -p ~/.claude
mkdir -p ~/Library/Application\ Support/Claude

echo -e "${GREEN}✓ 目錄已建立${NC}"

# Pull latest image
echo ""
echo -e "${YELLOW}下載 Nova AI Monitor 映像檔...${NC}"
docker pull ghcr.io/petertzeng0610/openclaw-monitor:latest

echo -e "${GREEN}✓ 映像檔下載完成${NC}"

# Stop existing container if any
echo ""
echo -e "${YELLOW}停止現有容器...${NC}"
docker rm -f nova-ai-monitor 2>/dev/null || true

# Run container with volume mounts
echo ""
echo -e "${YELLOW}啟動 Nova AI Monitor...${NC}"

docker run -d \
    --name nova-ai-monitor \
    -p 3847:3847 \
    -v ~/.openclaw:/home/openclaw/.openclaw:ro \
    -v ~/.claude:/home/openclaw/.claude:ro \
    -v "~/Library/Application Support/Claude:/home/openclaw/claude-coworker:ro" \
    -v "~/Library/Application Support/NovaAIMonitor:/home/openclaw/data" \
    --restart unless-stopped \
    ghcr.io/petertzeng0610/openclaw-monitor:latest

echo -e "${GREEN}✓ Nova AI Monitor 已啟動！${NC}"

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           安裝完成！                    ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "開啟瀏覽器訪問: ${GREEN}http://localhost:3847${NC}"
echo ""
echo -e "常用指令:"
echo -e "  查看日誌: ${YELLOW}docker logs nova-ai-monitor${NC}"
echo -e "  停止服務: ${YELLOW}docker stop nova-ai-monitor${NC}"
echo -e "  重新啟動: ${YELLOW}docker restart nova-ai-monitor${NC}"
echo -e "  卸載程式: ${YELLOW}docker rm -f nova-ai-monitor${NC}"
echo ""
