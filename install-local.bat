@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: Nova AI Monitor - Windows Installer
title Nova AI Monitor - 安裝程式
color 1b

echo ╔═══════════════════════════════════════════╗
echo ║     Nova AI Monitor - 安裝程式          ║
echo ╚═══════════════════════════════════════════╝
echo.

:: Check Docker
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [錯誤] Docker 未安裝
    echo 請先安裝 Docker Desktop: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo [✓] Docker 已安裝

:: Check Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [錯誤] Docker 未運行
    echo 請啟動 Docker Desktop
    pause
    exit /b 1
)

echo [✓] Docker 正在運行

:: Create directories
echo.
echo [?] 建立資料目錄...
if not exist "%USERPROFILE%\AppData\Local\NovaAIMonitor" mkdir "%USERPROFILE%\AppData\Local\NovaAIMonitor"
if not exist "%USERPROFILE%\.openclaw" mkdir "%USERPROFILE%\.openclaw"
if not exist "%USERPROFILE%\.claude" mkdir "%USERPROFILE%\.claude"
echo [✓] 目錄已建立

:: Pull image
echo.
echo [?] 下載 Nova AI Monitor 映像檔...
docker pull ghcr.io/petertzeng0610/openclaw-monitor:latest
echo [✓] 映像檔下載完成

:: Stop existing
echo.
echo [?] 停止現有容器...
docker rm -f nova-ai-monitor 2>nul

:: Run container
echo.
echo [?] 啟動 Nova AI Monitor...
docker run -d --name nova-ai-monitor -p 3847:3847 -v "%USERPROFILE%\.openclaw:/home/openclaw/.openclaw:ro" -v "%USERPROFILE%\.claude:/home/openclaw/.claude:ro" -v "%USERPROFILE%\AppData\Local\NovaAIMonitor:/home/openclaw/data" --restart unless-stopped ghcr.io/petertzeng0610/openclaw-monitor:latest

echo [✓] Nova AI Monitor 已啟動！

echo.
echo ╔═══════════════════════════════════════════╗
echo ║           安裝完成！                    ║
echo ╚═══════════════════════════════════════════╝
echo.
echo 開啟瀏覽器訪問: http://localhost:3847
echo.
echo 常用指令:
echo   查看日誌: docker logs nova-ai-monitor
echo   停止服務: docker stop nova-ai-monitor
echo   重新啟動: docker restart nova-ai-monitor
echo   卸載程式: docker rm -f nova-ai-monitor
echo.
pause
