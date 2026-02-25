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
      let firstUserMessage = '';
      let currentTask = '';
      const tools = new Set();
      let modelId = 'google/gemini-2.5-flash';
      const taskItems = [];
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const type = entry.type;
          
          if (type === 'message') {
            messageCount++;
            const msg = entry.message;
            const role = msg?.role;
            
            // Extract text content from message
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
            
            // Capture first user message as task name
            if (role === 'user' && !firstUserMessage && textContent) {
              firstUserMessage = textContent;
              currentTask = this.extractTaskName(textContent);
            }
            
            // Get the last message for summary
            if (textContent) {
              lastMessage = textContent;
            }
            
            // Get tool calls and track tasks
            if (msg?.tool_calls) {
              for (const tc of msg.tool_calls) {
                const toolName = tc.function?.name || tc.name || 'unknown';
                tools.add(toolName);
                
                // Track task items from tool usage
                if (toolName === 'write' || toolName === 'edit') {
                  const args = tc.function?.arguments;
                  if (args && typeof args === 'string') {
                    try {
                      const parsed = JSON.parse(args);
                      const filePath = parsed.file_path || parsed.path || '';
                      if (filePath) {
                        const fileName = filePath.split('/').pop();
                        if (fileName && !taskItems.find(t => t.name === fileName)) {
                          taskItems.push({
                            name: fileName,
                            status: 'pending',
                            tool: toolName
                          });
                        }
                      }
                    } catch {}
                  }
                }
              }
            }
            
            // Track task completion from tool results
            if (role === 'tool') {
              const toolName = msg.name || 'unknown';
              for (const item of taskItems) {
                if (msg.content?.includes(item.name)) {
                  item.status = 'completed';
                  item.result = msg.content?.slice(0, 100);
                }
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
      const isActive = fileAge < 300000; // 5 minutes - more lenient for AI tasks
      
      // Calculate progress based on task items
      const completedItems = taskItems.filter(t => t.status === 'completed').length;
      let progress = 0;
      if (taskItems.length > 0) {
        progress = Math.round((completedItems / taskItems.length) * 100);
      } else if (messageCount > 0 && !isActive) {
        // Only show 100% if session is actually completed (not active)
        progress = Math.min(messageCount * 8, 95); // Cap at 95% for active tasks
      } else if (isActive) {
        // Active session - show in-progress based on message count
        progress = Math.min(messageCount * 5, 90); // Cap at 90% for active
      }
      
      // Calculate time spent
      const timeSpent = stats.mtime.getTime() - stats.birthtime.getTime();
      
      // Generate agent name based on agent type and session
      const agentDisplayNames = {
        'main': ['🧑‍💼 主 Agent', '👨‍💻 主程式設計師', '📋 專案管理員', '🎯 任務調度員'],
        'coding-agent': ['💻 程式碼 Agent', '🔧 開發 Agent', '⚙️ 技術 Agent', '🛠️ 實作 Agent']
      };
      const names = agentDisplayNames[agentName] || ['🤖 Agent'];
      const agentIndex = Math.abs(this.hashCode(sessionId)) % names.length;
      const displayAgentName = names[agentIndex];
      
      const sessionData = {
        id: sessionId,
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
        taskItems: taskItems.slice(0, 10), // Limit to 10 items
        summary: {
          title: lastMessage.slice(0, 150) || (isActive ? '執行中...' : '已完成')
        }
      };

      this.sessionCache.set(sessionId, sessionData);
      this.datastore.saveSession(sessionData);
      
      this.emit('agentUpdate', sessionData);
    } catch (error) {
      // File might be locked or empty
    }
  }
  
  extractTaskName(content) {
    if (!content) return '';
    
    // Clean up the content
    let cleaned = content;
    
    // Remove timestamp prefix like [Wed 2026-02-25 11:52 GMT+8]
    cleaned = cleaned.replace(/\[.*?\]\s*/g, '');
    
    // Remove System: prefix
    cleaned = cleaned.replace(/System:.*?$/gm, '');
    
    // Remove message_id
    cleaned = cleaned.replace(/\[message_id:.*?\]/g, '');
    
    // Remove task description prefix
    cleaned = cleaned.replace(/^任務描述：\s*/g, '');
    cleaned = cleaned.replace(/^請/g, '');
    
    // Clean up remaining content
    cleaned = cleaned
      .replace(/[#*`\n]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Take first 35 characters or first sentence
    if (cleaned.length <= 35) return cleaned;
    
    // Try to get a meaningful first sentence
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
