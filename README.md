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
- 🤖 **AI 助手** - 透過 Chat 介面調用 OpenClaw Skills
- 🎨 **Nova Style** - 深色毛玻璃 UI

---

## 🤖 AI 助手功能 (AI Assistant)

AI 助手是 Nova AI Monitor 的核心功能之一，允許用戶透過圖形化介面與 OpenClaw 進行互動，觸發各種 Skills 技能。

### 功能介紹

1. **技能卡片網格** - 顯示所有可用的 AI 技能
2. **即時對話** - 類似 ChatGPT 的對話體驗
3. **任務輪詢** - 長時間任務的進度追蹤
4. **技能系統** - 支援多種 AI 能力

### 支援的 Skills

| 技能 | 描述 | 圖示 |
|------|------|------|
| 程式開發代理 | 透過 Codex/Claude Code/OpenCode 進行程式開發 | 🧩 |
| Gemini 問答 | 使用 Gemini 進行問答、摘要與內容生成 | ✨ |
| GitHub 操作 | 透過 gh CLI 管理 Issues、PR、CI | 🐙 |
| Google 工具 | Gmail、日曆、雲端硬碟、試算表、文件 | 📧 |
| 資安檢查 | 主機資安強化與風險評估 | 🔒 |
| 技能建立器 | 建立或更新 Agent 技能套件 | 🛠️ |
| UI/UX 設計 | AI 驅動的設計系統產生器 | 🎨 |
| 影片擷取 | 從影片中擷取畫面或短片段 | 🎬 |
| 天氣查詢 | 查詢天氣與天氣預報 | 🌤️ |
| AI 簡報產生器 | 產生專業 PowerPoint 簡報 | 📊 |

---

### 技術實踐

#### 架構圖

```
┌─────────────────────────────────────────────────────────────┐
│                     Nova AI Monitor                          │
│  ┌─────────────────┐         ┌─────────────────────────────┐ │
│  │   React Frontend │         │    Node.js Backend         │ │
│  │  ┌───────────┐  │         │  ┌─────────────────────┐   │ │
│  │  │ ChatPage  │  │         │  │ POST /api/chat/send │   │ │
│  │  │ChatWindow │  │◄───────►│  └──────────┬──────────┘   │ │
│  │  │ useChat   │  │  HTTP   │             │               │ │
│  │  └───────────┘  │         │             ▼               │ │
│  └─────────────────┘         │  ┌─────────────────────┐     │ │
│                              │  │ sendToOpenClaw()    │     │ │
│                              │  │ (WebSocket Client)  │     │ │
│                              │  └──────────┬──────────┘     │ │
│                              └─────────────┼────────────────┘ │
│                                                │              │
└────────────────────────────────────────────────┼──────────────┘
                                                 │ WebSocket
                                                 ▼
                                    ┌────────────────────────┐
                                    │  OpenClaw Gateway      │
                                    │  ws://localhost:18789  │
                                    │                        │
                                    │  - JSON-RPC Protocol   │
                                    │  - Token Auth          │
                                    │  - Skill Execution     │
                                    └────────────────────────┘
```

#### 前端實作

**1. ChatPage.jsx** (`web/src/pages/ChatPage.jsx`)
- 主頁面元件，顯示技能卡片網格
- 選擇技能後切換到對話視圖

**2. ChatWindow.jsx** (`web/src/components/ChatWindow.jsx`)
- 訊息顯示元件
- 支援使用者/AI 訊息渲染
- 載入動畫 (Loading Dots)

**3. useChat.js** (`web/src/hooks/useChat.js`)
- 狀態管理鉤子
- 處理 API 調用與任務輪詢

```javascript
// 核心流程
const sendMessage = async (text) => {
  // 1. 發送到後端
  const res = await fetch('/api/chat/send', {
    method: 'POST',
    body: JSON.stringify({ skill: selectedSkill.name, message: text })
  })
  const { taskId } = await res.json()
  
  // 2. 輪詢任務狀態
  pollTaskStatus(taskId)
}

const pollTaskStatus = (taskId) => {
  setInterval(async () => {
    const res = await fetch(`/api/chat/status/${taskId}`)
    const data = await res.json()
    if (data.status === 'completed') {
      // 顯示結果
    }
  }, 2000)
}
```

#### 後端實作

**API 端點** (`src/api.js`)

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/chat/send` | POST | 發送訊息到 OpenClaw |
| `/api/chat/status/:taskId` | GET | 輪詢任務狀態 |
| `/api/chat/history` | GET | 獲取對話歷史 |

**WebSocket 連線** (`src/api.js:510`)

```javascript
const sendToOpenClaw = async (message, timeoutMs = 120000) => {
  // 1. 建立 WebSocket 連線
  const ws = new WebSocket('ws://localhost:18789/ws')
  
  // 2. 處理認證挑戰
  ws.on('message', (data) => {
    if (data.event === 'connect.challenge') {
      ws.send({
        type: 'req',
        method: 'connect',
        params: { auth: { token }, ... }
      })
    }
    
    // 3. 發送 Chat 請求
    if (data.ok) {
      ws.send({
        type: 'req',
        method: 'chat.send',
        params: { message, ... }
      })
    }
    
    // 4. 接收回應
    if (data.type === 'event' && data.event === 'chat.message') {
      resolve(data.content)
    }
  })
}
```

#### OpenClaw Gateway 串接

**連線參數**
- **URL**: `ws://localhost:18789/ws`
- **Protocol**: JSON-RPC 2.0
- **認證**: Token (從 `~/.openclaw/gateway.json` 讀取)

**認證流程**
1. Gateway 發送 `connect.challenge` 事件
2. Client 回傳 `connect` 請求，包含 token
3. 驗證成功後才能發送後續請求

**訊息格式**
```json
// 請求
{
  "type": "req",
  "id": "chat-1",
  "method": "chat.send",
  "params": {
    "message": "請幫我寫一個 Hello World 程式",
    "skill": "coding-agent"
  }
}

// 回應
{
  "type": "event",
  "event": "chat.message",
  "data": {
    "content": "這是一個 Hello World 程式..."
  }
}
```

---

### 前置需求

1. **OpenClaw Gateway 必須運行**
   ```bash
   # 確認 Gateway 運行狀態
   curl http://localhost:18789/health
   ```

2. **設定 Token**
   - 確保 `~/.openclaw/gateway.json` 存在且包含有效 token

3. **防火牆**
   - 確保 localhost:18789 可訪問

---

### 常見問題

**Q: 發送訊息後沒有回應？**
A: 檢查 OpenClaw Gateway 是否運行，以及 token 是否正確

**Q: 任務超時？**
A: 預設 timeout 為 120 秒，複雜任務可能需要更長

**Q: 如何新增自訂技能？**
A: 在 `useChat.js` 的 `SKILLS_LIST` 中新增項目

---

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
5. **AI 助手** - Chat 介面調用 OpenClaw Skills
6. **設定** - 成本參數配置

## 技術棧

- Frontend: React + Tailwind CSS + Framer Motion + Recharts
- Backend: Node.js + Express + WebSocket
- Real-time: Server-Sent Events (SSE)
- Deployment: Docker

## License

MIT
