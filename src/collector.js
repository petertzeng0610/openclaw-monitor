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

console.log('[Collector] Using OpenClaw path:', OPENCLAW_DIR);

export class AgentCollector extends EventEmitter {
  constructor(datastore) {
    super();
    this.datastore = datastore;
    this.watchers = [];
    this.sessionCache = new Map();
    this.lastProcessed = new Map();
  }

  async start() {
    console.log('[Collector] Starting agent data collection...');
    
    await this.watchAllAgentSessions();
    await this.watchLogs();
    await this.collectAllAgentData();
    
    console.log('[Collector] Data collection started');
  }

  async collectAllAgentData() {
    try {
      const agentDirs = await fs.readdir(AGENTS_DIR, { withFileTypes: true });
      
      for (const agentDir of agentDirs) {
        if (agentDir.isDirectory()) {
          const sessionsPath = path.join(AGENTS_DIR, agentDir.name, 'sessions');
          try {
            const files = await fs.readdir(sessionsPath);
            for (const file of files) {
              if (file.endsWith('.jsonl')) {
                await this.processSessionFile(file, agentDir.name);
              }
            }
          } catch (e) {}
        }
      }
    } catch (error) {
      console.error('[Collector] Error collecting initial data:', error.message);
    }
  }

  async watchAllAgentSessions() {
    const watcher = watch(AGENTS_DIR, {
      depth: 2,
      ignored: /^\./,
      persistent: true
    });

    watcher.on('add', async (filePath) => {
      if (filePath.endsWith('.jsonl')) {
        const parts = filePath.split('/');
        const agentIdx = parts.indexOf('agents');
        const agentName = parts[agentIdx + 1];
        const fileName = path.basename(filePath);
        await this.processSessionFile(fileName, agentName);
      }
    });

    watcher.on('change', async (filePath) => {
      if (filePath.endsWith('.jsonl')) {
        const parts = filePath.split('/');
        const agentIdx = parts.indexOf('agents');
        const agentName = parts[agentIdx + 1];
        const fileName = path.basename(filePath);
        await this.processSessionFile(fileName, agentName);
      }
    });

    this.watchers.push(watcher);
  }

  async processSessionFile(fileName, agentName = 'main') {
    const sessionId = fileName.replace('.jsonl', '');
    const filePath = path.join(AGENTS_DIR, agentName, 'sessions', fileName);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) return;
      
      let messageCount = 0;
      let lastMessage = '';
      const tools = new Set();
      let modelId = 'google/gemini-2.5-flash';
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const type = entry.type;
          
          if (type === 'message') {
            messageCount++;
            // Get the content from the message
            if (entry.message?.content) {
              if (typeof entry.message.content === 'string') {
                lastMessage = entry.message.content;
              } else if (entry.message.content[0]?.text) {
                lastMessage = entry.message.content[0].text;
              }
            }
            // Get tool calls
            if (entry.message?.tool_calls) {
              for (const tc of entry.message.tool_calls) {
                tools.add(tc.function?.name || tc.name || 'unknown');
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
      const isActive = fileAge < 300000; // 5 minutes
      
      const sessionData = {
        id: sessionId,
        agent: agentName,
        name: `${agentName} - ${sessionId.slice(0, 8)}`,
        status: isActive ? 'active' : 'idle',
        createdAt: stats.birthtime.getTime(),
        updatedAt: stats.mtime.getTime(),
        messages: messageCount,
        tools: Array.from(tools),
        model: modelId,
        summary: {
          title: lastMessage.slice(0, 100) || (isActive ? '執行中...' : '已完成')
        }
      };

      this.sessionCache.set(sessionId, sessionData);
      this.datastore.saveSession(sessionData);
      
      this.emit('agentUpdate', sessionData);
    } catch (error) {
      // File might be locked or empty
    }
  }

  async watchLogs() {
    const watcher = watch(path.join(LOGS_DIR, '*.log'), {
      persistent: true
    });

    let lastSize = 0;
    
    watcher.on('change', async (filePath) => {
      try {
        const stats = await fs.stat(filePath);
        if (stats.size > lastSize) {
          const content = await fs.readFile(filePath, 'utf-8');
          const newContent = content.slice(lastSize);
          await this.parseLogEntries(newContent);
          lastSize = stats.size;
        }
      } catch (error) {
        // File might be locked
      }
    });

    this.watchers.push(watcher);
  }

  async parseLogEntries(content) {
    const lines = content.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        
        if (entry.message?.includes('agent') || entry.message?.includes('task')) {
          this.emit('agentUpdate', {
            timestamp: entry.timestamp || Date.now(),
            message: entry.message,
            level: entry.level
          });
        }
      } catch {
        // Not JSON, might be plain text log
      }
    }
  }

  async processSession(sessionName) {
    try {
      const sessionPath = path.join(SESSIONS_DIR, sessionName);
      const files = await fs.readdir(sessionPath);
      
      const agentFile = files.find(f => f.endsWith('.json') && !f.startsWith('.'));
      if (!agentFile) return;

      const agentPath = path.join(sessionPath, agentFile);
      const content = await fs.readFile(agentPath, 'utf-8');
      const data = JSON.parse(content);

      const sessionData = {
        id: sessionName,
        name: this.extractSessionName(data),
        status: this.detectStatus(data, sessionName),
        createdAt: this.extractCreatedTime(data),
        updatedAt: await this.getFileMtime(agentPath),
        messages: data.messages?.length || 0,
        tools: this.extractTools(data),
        model: this.extractModel(data),
        summary: this.extractSummary(data)
      };

      this.sessionCache.set(sessionName, sessionData);
      this.datastore.saveSession(sessionData);
      
      this.emit('agentUpdate', sessionData);
    } catch (error) {
      // Session might be in progress
    }
  }

  extractSessionName(data) {
    if (data.name) return data.name;
    if (data.summary?.title) return data.summary.title;
    return 'Unnamed Session';
  }

  detectStatus(data, sessionName) {
    if (sessionName.includes('active')) return 'active';
    if (data.messages?.length > 0) {
      const lastMsg = data.messages[data.messages.length - 1];
      if (lastMsg?.role === 'assistant' && !lastMsg?.content) return 'processing';
      return 'completed';
    }
    return 'idle';
  }

  extractCreatedTime(data) {
    if (data.createdAt) return new Date(data.createdAt).getTime();
    if (data.meta?.createdAt) return new Date(data.meta.createdAt).getTime();
    return Date.now();
  }

  async getFileMtime(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.mtime.getTime();
    } catch {
      return Date.now();
    }
  }

  extractTools(data) {
    const tools = new Set();
    
    if (data.messages) {
      for (const msg of data.messages) {
        if (msg.tool_calls) {
          for (const call of msg.tool_calls) {
            tools.add(call.function?.name || call.name);
          }
        }
      }
    }
    
    return Array.from(tools);
  }

  extractModel(data) {
    if (data.model) return data.model;
    if (data.metadata?.model) return data.metadata.model;
    return 'unknown';
  }

  extractSummary(data) {
    if (data.summary) return data.summary;
    if (data.messages?.length > 0) {
      const lastUserMsg = [...data.messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        return {
          title: lastUserMsg.content?.slice(0, 100),
          lastMessage: lastUserMsg.content?.slice(0, 200)
        };
      }
    }
    return {};
  }

  stop() {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }
}
