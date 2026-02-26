# Nova AI Monitor - AI 員工管理平台

一個功能強大的 AI 員工監控與管理平台，支持 OpenClaw、Claude Code 和 Claude Code Coworker。

## 功能特色

- 🌐 **多平台支援** - 監控 OpenClaw、Claude Code、Coworker
- 📊 **部門化監控** - 按部門分組顯示 AI 員工
- 🎯 **即時狀態** - Live Pulse Bar 顯示運行狀態
- 📋 **任務中心** - 工作流水線監控與異常處理
- 🔔 **異常通知** - 統一通知中心與歷史記錄
- ⚙️ **參數配置** - 自定義成本與價值計算
- 👤 **員工檔案** - 技能矩陣 Radar Chart
- 🎨 **Nova Style** - 深色毛玻璃 UI

## 系統需求

- Docker 20.10+
- macOS 或 Windows 10+
- 建議 4GB+ RAM

## 安裝方式

### 🖥️ 本機安裝（推薦）

#### macOS
```bash
# 下載專案
git clone https://github.com/petertzeng0610/openclaw-monitor.git
cd openclaw-monitor

# 執行安裝
chmod +x install-local.sh
./install-local.sh
```

#### Windows
```
# 下載專案
git clone https://github.com/petertzeng0610/openclaw-monitor.git
cd openclaw-monitor

# 執行安裝 (以系統管理員身份)
install-local.bat
```

安裝完成後開啟瀏覽器訪問：http://localhost:3847

### ☁️ Docker Compose（服務器部署）

```bash
cd /Users/peter/openclaw_dashboard
docker-compose up -d
```

### 🐳 Docker Run

```bash
docker run -d \
  --name nova-ai-monitor \
  -p 3847:3847 \
  -v ~/.openclaw:/home/openclaw/.openclaw:ro \
  -v ~/.claude:/home/openclaw/.claude:ro \
  -v "~/Library/Application Support/Claude:/home/openclaw/claude-coworker:ro" \
  --restart unless-stopped \
  ghcr.io/petertzeng0610/openclaw-monitor:latest
```

## 快速操作

| 操作 | 指令 |
|------|------|
| 查看日誌 | `docker logs nova-ai-monitor` |
| 停止服務 | `docker stop nova-ai-monitor` |
| 重新啟動 | `docker restart nova-ai-monitor` |
| 卸載程式 | `docker rm -f nova-ai-monitor` |

## 頁面導覽

1. **總覽** - 即時監控儀表板，部門折疊清單
2. **AI 員工** - 完整 Agent 卡片網格，點擊查看檔案
3. **任務中心** - 工作流水線，異常處理
4. **異常通知** - 統一通知中心
5. **設定** - 成本參數配置

## 技術棧

- Frontend: React + Tailwind CSS + Framer Motion + Recharts
- Backend: Node.js + Express
- Deployment: Docker

## License

MIT
