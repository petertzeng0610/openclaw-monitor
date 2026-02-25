# OpenClaw Monitor Dashboard - Docker Deployment

一個可以部署在任何 Linux 或 macOS 環境的 OpenClaw Agent 監控面板。

## 功能特色

- 🌐 **Web 儀表板** - 即時監控所有 Agent 狀態
- 📊 **任務追蹤** - 顯示執行中的任務與進度
- 📋 **完成報告** - 檢視每個任務的詳細成果報告
- 🔔 **推播通知** - 任務完成時發送桌面/手機通知
- 🔄 **即時更新** - 每 15 秒自動刷新數據

## 系統需求

- Docker 20.10+
- Docker Compose (可選)
- OpenClaw 已安裝並正常運作

## 快速開始

### 方法一：使用 Docker Compose（推薦）

```bash
# 1. 進入專案目錄
cd /Users/peter/openclaw_dashboard

# 2. 啟動容器
docker-compose up -d

# 3. 查看日誌
docker-compose logs -f
```

### 方法二：使用 Docker Run

```bash
docker run -d \
  --name openclaw-monitor \
  -p 3847:3847 \
  -v ~/.openclaw:/home/openclaw/.openclaw:ro \
  openclaw/monitor:latest
```

## 訪問儀表板

啟動後訪問：http://localhost:3847

## 常見操作

| 操作 | 指令 |
|------|------|
| 停止監控 | `docker-compose down` 或 `docker stop openclaw-monitor` |
| 重新啟動 | `docker-compose restart` 或 `docker restart openclaw-monitor` |
| 查看日誌 | `docker-compose logs -f` 或 `docker logs -f openclaw-monitor` |
| 重新建構 | `docker-compose build --no-cache` |

## 自訂配置

### 變更監控端口

編輯 `docker-compose.yml`：

```yaml
ports:
  - "8080:3847"  # 改為 8080
```

然後重新啟動：

```bash
docker-compose down
docker-compose up -d
```

### 自訂 OpenClaw 路徑

如果您的 OpenClaw 安裝在非預設位置，請修改 `docker-compose.yml`：

```yaml
environment:
  - OPENCLAW_PATH=/自訂/路徑/.openclaw
volumes:
  - /自訂/路徑:/home/openclaw/.openclaw:ro
```

## 故障排除

### 看不到 Agent 數據

1. 確認 OpenClaw 正在運作
2. 檢查 volume mount 是否正確：
   ```bash
   docker exec openclaw-monitor ls -la /home/openclaw/.openclaw/agents/
   ```
3. 查看收集器日誌：
   ```bash
   docker logs openclaw-monitor
   ```

### 端口已被佔用

更換端口或停止佔用端口的程式：

```bash
# 找到佔用端口的程式
lsof -i :3847

# 更換端口
docker-compose down
# 編輯 docker-compose.yml 改端口
docker-compose up -d
```

## 建構選項

### 只建構 Docker 映像

```bash
./build.sh
```

### 使用安裝腳本（自動安裝 Docker）

```bash
chmod +x install.sh
./install.sh
```

## 技術細節

- **基礎影像**: Node.js 20 Alpine
- **監控端口**: 3847 (可自訂)
- **數據刷新**: 每 15 秒自動更新
- **活躍閾值**: 2 分鐘內有更新視為作用中

## 授權

MIT License
