import { EventEmitter } from 'events';
import { watch } from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Support custom OpenClaw path via environment variable
const OPENCLAW_DIR = process.env.OPENCLAW_PATH || '/home/openclaw/.openclaw';
const AGENTS_DIR = path.join(OPENCLAW_DIR, 'agents');
const LOGS_DIR = path.join(OPENCLAW_DIR, 'logs');

// Claude Code paths
const CLAUDE_CODE_DIR = process.env.CLAUDE_CODE_PATH || 
  (process.env.HOME ? path.join(process.env.HOME, '.claude') : '/home/openclaw/.claude');

console.log('[Collector] Using paths:', { OPENCLAW_DIR, CLAUDE_CODE_DIR });

// Data source configurations
const DATA_SOURCES = {
  openclaw: {
    name: 'OpenClaw',
    basePath: AGENTS_DIR,
    agentDirs: ['main', 'coding-agent'],
    sessionsPattern: '**/sessions/*.jsonl',
    type: 'openclaw'
  },
  claude: {
    name: 'Claude Code',
    basePath: CLAUDE_CODE_DIR,
    agentDirs: ['projects'],
    sessionsPattern: '**/*.jsonl',
    type: 'claude'
  }
};

export class AgentCollector extends EventEmitter {
  constructor(datastore) {
    super();
    this.datastore = datastore;
    this.watchers = [];
    this.sessionCache = new Map();
    this.lastProcessed = new Map();
    this.departments = new Map();
  }

  async start() {
    console.log('[Collector] Starting multi-department agent data collection...');
    
    await this.detectDepartments();
    await this.watchAllDepartments();
    await this.watchLogs();
    await this.collectAllData();
    
    console.log('[Collector] Data collection started');
    console.log('[Collector] Departments:', Array.from(this.departments.keys()));
  }

  async detectDepartments() {
    this.departments.clear();
    
    // Detect OpenClaw
    try {
      const openclawAgents = await fs.readdir(AGENTS_DIR).catch(() => []);
      if (openclawAgents.length > 0) {
        this.departments.set('openclaw', {
          id: 'openclaw',
          name: 'OpenClaw 開發團隊',
          type: 'openclaw',
          path: AGENTS_DIR,
          agentCount: openclawAgents.length
        });
      }
    } catch {}

    // Detect Claude Code - use the parent .claude directory
    const claudePaths = [
      path.join(process.env.HOME || '/Users/peter', '.claude'),
      '/home/openclaw/.claude',
      path.join(process.env.HOME || '/Users/peter', 'Library/Application Support/Claude')
    ];

    for (const claudePath of claudePaths) {
      try {
        const exists = await fs.access(claudePath).then(() => true).catch(() => false);
        if (exists) {
          this.departments.set('claude', {
            id: 'claude',
            name: 'Claude Code 團隊',
            type: 'claude',
            path: claudePath,
            agentCount: 1
          });
          break;
        }
      } catch {}
    }
  }

  async collectAllData() {
    for (const [id, dept] of this.departments) {
      try {
        if (dept.type === 'openclaw') {
          await this.collectOpenClawData(dept);
        } else if (dept.type === 'claude') {
          await this.collectClaudeData(dept);
        }
      } catch (error) {
        console.error(`[Collector] Error collecting from ${id}:`, error.message);
      }
    }
  }

  async collectOpenClawData(dept) {
    try {
      const agentDirs = await fs.readdir(dept.path, { withFileTypes: true });
      
      for (const agentDir of agentDirs) {
        if (agentDir.isDirectory()) {
          const sessionsPath = path.join(dept.path, agentDir.name, 'sessions');
          try {
            const files = await fs.readdir(sessionsPath);
            for (const file of files) {
              if (file.endsWith('.jsonl')) {
                await this.processOpenClawSession(file, agentDir.name, dept);
              }
            }
          } catch (e) {}
        }
      }
    } catch (error) {
      console.error('[Collector] OpenClaw collection error:', error.message);
    }
  }

  async collectClaudeData(dept) {
    // Claude Code stores sessions in projects folder
    const projectsPath = path.join(dept.path, 'projects');
    
    try {
      const projectDirs = await fs.readdir(projectsPath, { withFileTypes: true });
      
      for (const projectDir of projectDirs) {
        if (projectDir.isDirectory()) {
          const projectSessionsPath = path.join(projectsPath, projectDir.name);
          try {
            const files = await fs.readdir(projectSessionsPath);
            for (const file of files) {
              if (file.endsWith('.jsonl') && !file.startsWith('agent-')) {
                await this.processClaudeSession(file, projectDir.name, dept);
              }
            }
          } catch (e) {}
        }
      }
    } catch (error) {
      // Try alternative path for Claude Code
      const altPath = path.join(process.env.HOME || '/Users/peter', '.claude/projects/-Users-peter');
      try {
        const files = await fs.readdir(altPath);
        for (const file of files) {
          if (file.endsWith('.jsonl')) {
            await this.processClaudeSession(file, 'default', dept);
          }
        }
      } catch {}
    }
  }

  async processOpenClawSession(fileName, agentName, dept) {
    const sessionId = fileName.replace('.jsonl', '');
    const filePath = path.join(dept.path, agentName, 'sessions', fileName);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) return;
      
      let messageCount = 0;
      let lastMessage = '';
      let firstUserMessage = '';
      let currentTask = '';
      const tools = new Set();
      let modelId = 'unknown';
      const taskItems = [];
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const type = entry.type;
          
          if (type === 'message') {
            messageCount++;
            const msg = entry.message;
            const role = msg?.role;
            
            let textContent = '';
            if (msg?.content) {
              if (typeof msg.content === 'string') {
                textContent = msg.content;
              } else if (Array.isArray(msg.content)) {
                for (const c of msg.content) {
                  if (c?.type === 'text') {
                    textContent = c.text || '';
                    break;
                  }
                }
              }
            }
            
            if (role === 'user' && !firstUserMessage && textContent) {
              firstUserMessage = textContent;
              currentTask = this.extractTaskName(textContent);
            }
            
            if (textContent) {
              lastMessage = textContent;
            }
            
            if (msg?.tool_calls) {
              for (const tc of msg.tool_calls) {
                const toolName = tc.function?.name || tc.name || 'unknown';
                tools.add(toolName);
              }
            }
          } else if (type === 'model_change') {
            modelId = entry.modelId || entry.model || modelId;
          }
        } catch {}
      }
      
      const stats = await fs.stat(filePath);
      const now = Date.now();
      const fileAge = now - stats.mtime.getTime();
      const isActive = fileAge < 300000;
      
      const completedItems = taskItems.filter(t => t.status === 'completed').length;
      let progress = 0;
      if (taskItems.length > 0) {
        progress = Math.round((completedItems / taskItems.length) * 100);
      } else if (messageCount > 0 && !isActive) {
        progress = Math.min(messageCount * 8, 95);
      } else if (isActive) {
        progress = Math.min(messageCount * 5, 90);
      }
      
      const timeSpent = stats.mtime.getTime() - stats.birthtime.getTime();
      
      // Generate agent name
      const agentDisplayNames = {
        'main': ['🧑‍💼 主 Agent', '👨‍💻 主程式設計師', '📋 專案管理員', '🎯 任務調度員'],
        'coding-agent': ['💻 程式碼 Agent', '🔧 開發 Agent', '⚙️ 技術 Agent', '🛠️ 實作 Agent']
      };
      const names = agentDisplayNames[agentName] || ['🤖 Agent'];
      const agentIndex = Math.abs(this.hashCode(sessionId)) % names.length;
      const displayAgentName = names[agentIndex];
      
      const sessionData = {
        id: sessionId,
        department: dept.id,
        departmentName: dept.name,
        agent: agentName,
        agentDisplayName: displayAgentName,
        taskName: currentTask || '未命名任務',
        status: isActive ? 'active' : 'idle',
        createdAt: stats.birthtime.getTime(),
        updatedAt: stats.mtime.getTime(),
        messages: messageCount,
        progress: progress,
        timeSpent: timeSpent,
        tools: Array.from(tools),
        model: modelId,
        taskItems: taskItems.slice(0, 10),
        summary: {
          title: lastMessage.slice(0, 150) || (isActive ? '執行中...' : '已完成')
        }
      };

      const cacheKey = `${dept.id}-${sessionId}`;
      this.sessionCache.set(cacheKey, sessionData);
      this.datastore.saveSession(sessionData);
      
      this.emit('agentUpdate', sessionData);
    } catch (error) {
      // File might be locked or empty
    }
  }

  async processClaudeSession(fileName, projectName, dept) {
    const sessionId = fileName.replace('.jsonl', '');
    const filePath = path.join(dept.path, 'projects', projectName, fileName);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) return;
      
      let messageCount = 0;
      let lastMessage = '';
      let firstUserMessage = '';
      let currentTask = '';
      const tools = new Set();
      let modelId = 'Claude';
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const type = entry.type;
          
          if (type === 'user' && entry.message?.content) {
            messageCount++;
            let textContent = '';
            if (typeof entry.message.content === 'string') {
              textContent = entry.message.content;
            } else if (Array.isArray(entry.message.content)) {
              for (const c of entry.message.content) {
                if (c?.type === 'text') {
                  textContent = c.text || '';
                  break;
                }
              }
            }
            
            if (!firstUserMessage && textContent) {
              firstUserMessage = textContent;
              currentTask = this.extractTaskName(textContent);
            }
            
            if (textContent) {
              lastMessage = textContent;
            }
          } else if (type === 'assistant' && entry.message?.content) {
            messageCount++;
            let textContent = '';
            if (Array.isArray(entry.message.content)) {
              for (const c of entry.message.content) {
                if (c?.type === 'text') {
                  textContent = c.text || '';
                  break;
                }
              }
            }
            if (textContent) {
              lastMessage = textContent;
            }
          }
        } catch {}
      }
      
      const stats = await fs.stat(filePath);
      const now = Date.now();
      const fileAge = now - stats.mtime.getTime();
      const isActive = fileAge < 300000;
      
      let progress = 0;
      if (messageCount > 0 && !isActive) {
        progress = Math.min(messageCount * 8, 95);
      } else if (isActive) {
        progress = Math.min(messageCount * 5, 90);
      }
      
      const timeSpent = stats.mtime.getTime() - stats.birthtime.getTime();
      
      // Claude Code agent names
      const agentNames = ['🦁 Claude', '🤖 AI 助手', '💡 智慧顧問', '🧠 深度思考'];
      const agentIndex = Math.abs(this.hashCode(sessionId)) % agentNames.length;
      const displayAgentName = agentNames[agentIndex];
      
      const sessionData = {
        id: sessionId,
        department: dept.id,
        departmentName: dept.name,
        agent: 'claude-assistant',
        agentDisplayName: displayAgentName,
        taskName: currentTask || `專案: ${projectName}`,
        status: isActive ? 'active' : 'idle',
        createdAt: stats.birthtime.getTime(),
        updatedAt: stats.mtime.getTime(),
        messages: messageCount,
        progress: progress,
        timeSpent: timeSpent,
        tools: Array.from(tools),
        model: modelId,
        taskItems: [],
        summary: {
          title: lastMessage.slice(0, 150) || (isActive ? '執行中...' : '已完成')
        }
      };

      const cacheKey = `${dept.id}-${sessionId}`;
      this.sessionCache.set(cacheKey, sessionData);
      this.datastore.saveSession(sessionData);
      
      this.emit('agentUpdate', sessionData);
    } catch (error) {
      // File might be locked or empty
    }
  }

  async watchAllDepartments() {
    // Watch OpenClaw
    try {
      const openclawWatcher = watch(AGENTS_DIR, {
        depth: 3,
        ignored: /^\./,
        persistent: true
      });

      openclawWatcher.on('add', async (filePath) => {
        if (filePath.endsWith('.jsonl')) {
          const parts = filePath.split('/');
          const agentIdx = parts.indexOf('agents');
          if (agentIdx !== -1) {
            const agentName = parts[agentIdx + 1];
            const dept = this.departments.get('openclaw');
            if (dept) {
              const fileName = path.basename(filePath);
              await this.processOpenClawSession(fileName, agentName, dept);
            }
          }
        }
      });

      openclawWatcher.on('change', async (filePath) => {
        if (filePath.endsWith('.jsonl')) {
          const parts = filePath.split('/');
          const agentIdx = parts.indexOf('agents');
          if (agentIdx !== -1) {
            const agentName = parts[agentIdx + 1];
            const dept = this.departments.get('openclaw');
            if (dept) {
              const fileName = path.basename(filePath);
              await this.processOpenClawSession(fileName, agentName, dept);
            }
          }
        }
      });

      this.watchers.push(openclawWatcher);
    } catch {}

    // Watch Claude Code
    const claudeWatchPaths = [
      path.join(process.env.HOME || '/Users/peter', '.claude/projects')
    ];

    for (const watchPath of claudeWatchPaths) {
      try {
        const watcher = watch(watchPath, {
          depth: 2,
          ignored: /^\./,
          persistent: true
        });

        watcher.on('add', async (filePath) => {
          if (filePath.endsWith('.jsonl')) {
            const dept = this.departments.get('claude');
            if (dept) {
              const fileName = path.basename(filePath);
              await this.processClaudeSession(fileName, 'project', dept);
            }
          }
        });

        watcher.on('change', async (filePath) => {
          if (filePath.endsWith('.jsonl')) {
            const dept = this.departments.get('claude');
            if (dept) {
              const fileName = path.basename(filePath);
              await this.processClaudeSession(fileName, 'project', dept);
            }
          }
        });

        this.watchers.push(watcher);
      } catch {}
    }
  }

  async watchLogs() {
    try {
      const watcher = watch(path.join(LOGS_DIR, '*.log'), {
        persistent: true
      });

      watcher.on('change', async (filePath) => {
        // Log changes are handled by periodic refresh
      });

      this.watchers.push(watcher);
    } catch {}
  }

  extractTaskName(content) {
    if (!content) return '';
    
    let cleaned = content;
    
    // Remove timestamp prefix
    cleaned = cleaned.replace(/\[.*?\]\s*/g, '');
    cleaned = cleaned.replace(/System:.*?$/gm, '');
    cleaned = cleaned.replace(/\[message_id:.*?\]/g, '');
    cleaned = cleaned.replace(/^任務描述：\s*/g, '');
    cleaned = cleaned.replace(/^請/g, '');
    
    cleaned = cleaned
      .replace(/[#*`\n]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (cleaned.length <= 35) return cleaned;
    
    const firstSentence = cleaned.split(/[.!?。！？\n]/)[0];
    if (firstSentence && firstSentence.length > 5) {
      return firstSentence.slice(0, 35);
    }
    
    return cleaned.slice(0, 35) + '...';
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  getDepartments() {
    return Array.from(this.departments.values());
  }

  updateDepartmentName(id, name) {
    if (this.departments.has(id)) {
      const dept = this.departments.get(id);
      dept.name = name;
      this.departments.set(id, dept);
    }
  }

  stop() {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }
}
