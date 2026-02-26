const { app, BrowserWindow, ipcMain, shell, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const log = require('electron-log');
const Store = require('electron-store');

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.info('App starting...');

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
  app.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason);
});

const store = new Store();

let mainWindow = null;
let tray = null;
let isQuitting = false;

const isDev = !app.isPackaged;

function createWindow() {
  log.info('Creating main window...');
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Nova AI Monitor',
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    log.info('Main window shown');
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle close to tray
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'Nova AI Monitor',
      submenu: [
        { label: '關於', role: 'about' },
        { type: 'separator' },
        { label: '偏好設定', accelerator: 'CmdOrCtrl+,', click: () => mainWindow?.webContents.send('open-settings') },
        { type: 'separator' },
        { label: '離開', accelerator: 'CmdOrCtrl+Q', click: () => { isQuitting = true; app.quit(); } }
      ]
    },
    {
      label: '編輯',
      submenu: [
        { label: '復原', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪下', role: 'cut' },
        { label: '複製', role: 'copy' },
        { label: '貼上', role: 'paste' },
        { label: '全選', role: 'selectAll' }
      ]
    },
    {
      label: '檢視',
      submenu: [
        { label: '重新載入', role: 'reload' },
        { label: '強制重新載入', role: 'forceReload' },
        { type: 'separator' },
        { label: '放大', role: 'zoomIn' },
        { label: '縮小', role: 'zoomOut' },
        { label: '重設大小', role: 'resetZoom' },
        { type: 'separator' },
        { label: '全螢幕', role: 'togglefullscreen' }
      ]
    },
    {
      label: '視窗',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '關閉', role: 'close' },
        { type: 'separator' },
        { label: '永遠在最上方', type: 'checkbox', click: (menuItem) => {
          mainWindow.setAlwaysOnTop(menuItem.checked);
        }}
      ]
    },
    {
      label: '說明',
      submenu: [
        { label: '線上文件', click: () => shell.openExternal('https://github.com/petertzeng0610/openclaw-monitor') },
        { label: '回報問題', click: () => shell.openExternal('https://github.com/petertzeng0610/openclaw-monitor/issues') }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray() {
  // Create a simple tray icon (16x16 colored square)
  const iconSize = 16;
  const icon = nativeImage.createEmpty();
  
  tray = new Tray(icon.resize({ width: iconSize, height: iconSize }));
  tray.setToolTip('Nova AI Monitor');
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '顯示主畫面', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: '離開', click: () => { isQuitting = true; app.quit(); } }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
}

// IPC handlers
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-user-data-path', () => app.getPath('userData'));
ipcMain.handle('get-home-path', () => app.getPath('home'));

// App lifecycle
app.whenReady().then(() => {
  log.info('App ready');
  createWindow();
  createTray();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

log.info('Main process initialized');
