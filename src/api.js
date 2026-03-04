import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_TOKEN = process.env.AUTH_TOKEN || 'nova-bridge-secret-2024';

const bridgeCache = {
  agents: [],
  lastSync: null,
  lastAgentDataUpdate: null
};

// Department mapping based on agent_id prefix
const departmentMap = {
  'finance': '財務部',
  'marketing': '行銷部',
  'engineering': '工程部',
  'support': '客服部',
  'sales': '銷售部',
  'hr': '人資部',
  'openclaw': 'openclaw',
  'claude-code': 'claude',
  'claude-coworker': 'claude-coworker'
};

function detectDepartment(agentId) {
  if (!agentId) return 'default';
  const prefix = agentId.split('-')[0].toLowerCase();
  return departmentMap[prefix] || 'default';
}

export class APIRouter {
  constructor(datastore, notifier, collector) {
    this.datastore = datastore;
    this.notifier = notifier;
    this.collector = collector;
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // Health check
    this.router.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // Departments
    this.router.get('/departments', (req, res) => {
      const departments = this.collector.getDepartments();
      const sessions = this.datastore.getSessions();
      const now = Date.now();
      const fiveMinAgo = now - 300000;
      
      // Group sessions by department and calculate stats
      const deptStats = {};
      for (const dept of departments) {
        const deptSessions = sessions.filter(s => s.department === dept.id);
        const activeSessions = deptSessions.filter(s => s.updatedAt && s.updatedAt > fiveMinAgo);
        deptStats[dept.id] = {
          totalAgents: deptSessions.length,
          activeAgents: activeSessions.length
        };
      }
      
      // Add department stats
      const departmentsWithStats = departments.map(d => ({
        ...d,
        stats: deptStats[d.id] || { totalAgents: 0, activeAgents: 0 }
      }));
      
      res.json(departmentsWithStats);
    });

    this.router.patch('/departments/:id', (req, res) => {
      const { id } = req.params;
      const { name } = req.body;
      
      if (name) {
        this.collector.updateDepartmentName(id, name);
      }
      
      res.json({ success: true, id, name });
    });

    // Stats
    this.router.get('/stats', (req, res) => {
      const stats = this.datastore.getStats();
      const sessions = this.datastore.getSessions();
      const now = Date.now();
      const fiveMinAgo = now - 300000; // 5 minutes - more lenient for AI tasks
      
      // Count active sessions (updated in last 5 minutes)
      const activeSessions = sessions.filter(s => 
        s.updatedAt && s.updatedAt > fiveMinAgo
      ).length;
      
      // Count active tasks (from sessions with recent updates)
      const activeTasks = sessions.filter(s =>
        s.updatedAt && s.updatedAt > fiveMinAgo && s.agent !== 'main'
      ).length;
      
      stats.activeSessions = activeSessions;
      stats.activeTasks = activeTasks;
      stats.totalSessions = sessions.length;
      
      res.json(stats);
    });

    // Sessions - return dynamic status based on current time
    this.router.get('/sessions', (req, res) => {
      const sessions = this.datastore.getSessions();
      const now = Date.now();
      const fiveMinAgo = now - 300000;
      
      // Add dynamic status based on current time
      const sessionsWithDynamicStatus = sessions.map(s => ({
        ...s,
        isActive: s.updatedAt && s.updatedAt > fiveMinAgo
      }));
      
      res.json(sessionsWithDynamicStatus);
    });

    this.router.get('/sessions/:id', (req, res) => {
      const session = this.datastore.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(session);
    });

    // Tasks
    this.router.get('/tasks', (req, res) => {
      const { status } = req.query;
      if (status) {
        return res.json(this.datastore.getTasksByStatus(status));
      }
      res.json(this.datastore.getTasks());
    });

    this.router.get('/tasks/:id', (req, res) => {
      const task = this.datastore.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(task);
    });

    this.router.post('/tasks', (req, res) => {
      const task = {
        id: `task_${Date.now()}`,
        ...req.body,
        status: 'pending',
        createdAt: Date.now()
      };
      this.datastore.saveTask(task);
      res.json(task);
    });

    this.router.patch('/tasks/:id', (req, res) => {
      const task = this.datastore.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const updated = { ...task, ...req.body, updatedAt: Date.now() };
      this.datastore.saveTask(updated);
      res.json(updated);
    });

    // Reports
    this.router.get('/reports', (req, res) => {
      res.json(this.datastore.getReports());
    });

    this.router.get('/reports/:id', (req, res) => {
      const report = this.datastore.getReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }
      res.json(report);
    });

    this.router.post('/reports', (req, res) => {
      const report = {
        id: `report_${Date.now()}`,
        ...req.body,
        createdAt: Date.now()
      };
      this.datastore.saveReport(report);
      res.json(report);
    });

    // Create agent team task
    this.router.post('/agent-team', async (req, res) => {
      const { task, agents, workflow } = req.body;
      
      const teamTask = {
        id: `team_${Date.now()}`,
        task,
        agents: agents || ['default'],
        workflow: workflow || [],
        status: 'orchestrating',
        createdAt: Date.now(),
        subtasks: [],
        report: null
      };
      
      this.datastore.saveTask(teamTask);
      
      // Emit event to start orchestration
      process.emit('agentTeamTask', teamTask);
      
      res.json(teamTask);
    });

    // Settings
    this.router.get('/settings', (req, res) => {
      res.json({
        notifierEnabled: this.notifier.enabled,
        pushSettings: this.notifier.pushSettings
      });
    });

    this.router.post('/settings', (req, res) => {
      const { notifierEnabled, pushSettings } = req.body;
      
      if (notifierEnabled !== undefined) {
        notifierEnabled ? this.notifier.enable() : this.notifier.disable();
      }
      
      if (pushSettings) {
        this.notifier.setPushSettings(pushSettings);
      }
      
      res.json({ success: true });
    });

    // Agent Skills - Get all agent profiles with skills
    this.router.get('/agents/skills', (req, res) => {
      const skills = this.datastore.getSkills();
      res.json(skills);
    });

    // Agent Skills - Sync skills from local folders
    this.router.post('/agents/sync-skills', async (req, res) => {
      try {
        const skillsDir = path.join(process.cwd(), 'skills');
        const agentProfiles = [];
        
        // Scan skills directories
        const skillDirs = ['openclaw', 'claude-code'];
        
        for (const dir of skillDirs) {
          const dirPath = path.join(skillsDir, dir);
          try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
              if (entry.isFile() && (entry.name.endsWith('.py') || entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
                const filePath = path.join(dirPath, entry.name);
                const content = await fs.readFile(filePath, 'utf-8');
                
                // Extract skill name from filename
                const skillName = entry.name
                  .replace(/\.(py|js|ts)$/, '')
                  .replace(/[-_]/g, ' ')
                  .replace(/\b\w/g, c => c.toUpperCase());
                
                // Extract capability score from comments
                // Look for @capability: [number] in comments
                const capabilityMatch = content.match(/(?:#|\/\/)\s*@capability:\s*(\d+)/i);
                const score = capabilityMatch ? parseInt(capabilityMatch[1]) : 70;
                
                // Extract description from comments
                // Look for @description: in comments
                const descMatch = content.match(/(?:#|\/\/)\s*@description:\s*(.+)/i);
                const description = descMatch ? descMatch[1].trim() : `Ability to perform ${skillName}`;
                
                agentProfiles.push({
                  skill: skillName,
                  score,
                  description,
                  source: dir,
                  file: entry.name
                });
              }
            }
          } catch (e) {
            console.log(`[Skills] Directory not found: ${dirPath}`);
          }
        }
        
        // Aggregate skills by name (combine scores from different sources)
        const aggregatedSkills = {};
        for (const skill of agentProfiles) {
          if (!aggregatedSkills[skill.skill]) {
            aggregatedSkills[skill.skill] = {
              name: skill.skill,
              score: skill.score,
              description: skill.description,
              sources: [skill.source]
            };
          } else {
            // Average the scores
            const existing = aggregatedSkills[skill.skill];
            existing.score = Math.round((existing.score + skill.score) / 2);
            existing.sources.push(skill.source);
          }
        }
        
        // Save to datastore
        const skillsList = Object.values(aggregatedSkills);
        for (const skill of skillsList) {
          this.datastore.saveSkill(skill);
        }
        
        res.json({ 
          success: true, 
          count: skillsList.length,
          skills: skillsList
        });
      } catch (error) {
        console.error('[Skills] Sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Bridge Auth Middleware
    this.router.use('/bridge', (req, res, next) => {
      const token = req.headers['x-auth-token'] || req.query['auth_token'];
      
      if (!token || token !== AUTH_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing AUTH_TOKEN' });
      }
      next();
    });

    // Bridge - Sync skills from local Bridge
    this.router.post('/bridge/sync-skills', (req, res) => {
      try {
        const { agents, skills } = req.body;
        
        // Cache agents data
        if (agents && Array.isArray(agents)) {
          bridgeCache.agents = agents;
        }
        
        // Also save skills if provided
        if (skills && Array.isArray(skills)) {
          for (const skill of skills) {
            this.datastore.saveSkill(skill);
          }
        }
        
        bridgeCache.lastSync = Date.now();
        
        res.json({ 
          success: true, 
          message: 'Skills synced successfully',
          cachedAgents: bridgeCache.agents.length,
          lastSync: bridgeCache.lastSync
        });
      } catch (error) {
        console.error('[Bridge] Sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Bridge - Get cached data (also requires auth)
    this.router.get('/bridge/status', (req, res) => {
      res.json({
        agents: bridgeCache.agents,
        lastSync: bridgeCache.lastSync
      });
    });

    // V1 - Sync agent data from Bridge
    this.router.post('/v1/sync-agent-data', (req, res) => {
      try {
        const { agent_id, skills, status, task_name, metadata } = req.body;
        
        if (!agent_id) {
          return res.status(400).json({ error: 'Missing agent_id' });
        }

        const department = detectDepartment(agent_id);
        const now = Date.now();

        // Create or update session for this agent
        const sessionId = `bridge_${agent_id}_${Date.now()}`;
        const session = {
          id: sessionId,
          agentId: agent_id,
          agent: agent_id,
          agentDisplayName: agent_id,
          department: department,
          taskName: task_name || 'Idle',
          status: status || 'active',
          summary: { title: metadata?.description || 'Received from Bridge' },
          progress: metadata?.progress || 0,
          messages: metadata?.messages || 0,
          skills: skills || [],
          updatedAt: now,
          source: 'bridge',
          metadata: metadata || {}
        };

        // Save to datastore
        this.datastore.saveSession(session);

        // Update bridge cache
        const existingAgentIndex = bridgeCache.agents.findIndex(a => a.agent_id === agent_id);
        const agentData = {
          agent_id,
          department,
          skills: skills || [],
          status: status || 'active',
          task_name: task_name,
          metadata,
          lastUpdate: now
        };

        if (existingAgentIndex >= 0) {
          bridgeCache.agents[existingAgentIndex] = agentData;
        } else {
          bridgeCache.agents.push(agentData);
        }

        bridgeCache.lastSync = now;
        bridgeCache.lastAgentDataUpdate = now;

        // Emit SSE event for real-time update
        const eventData = {
          type: 'agent-data-updated',
          timestamp: now,
          agent: agentData,
          department: department
        };

        // Store event for SSE clients (handled by server)
        if (global.broadcastAgentUpdate) {
          global.broadcastAgentUpdate(eventData);
        }

        console.log(`[V1] Synced agent: ${agent_id} -> Department: ${department}`);

        res.json({ 
          success: true, 
          agent_id,
          department,
          timestamp: now,
          message: `Agent data synced to ${department}`
        });
      } catch (error) {
        console.error('[V1] Sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // V1 - Get all synced agents
    this.router.get('/v1/agents', (req, res) => {
      res.json({
        agents: bridgeCache.agents,
        lastSync: bridgeCache.lastSync,
        lastAgentDataUpdate: bridgeCache.lastAgentDataUpdate
      });
    });

    // ============ CHAT / SKILLS ROUTES ============

    const chatTasks = {};
    const chatHistory = [];

    const SKILLS_LIST = [
      { name: "coding-agent", label: "程式開發代理", emoji: "🧩", description: "透過 Codex/Claude Code/OpenCode 進行程式開發" },
      { name: "gemini", label: "Gemini 問答", emoji: "✨", description: "使用 Gemini 進行問答、摘要與內容生成" },
      { name: "github", label: "GitHub 操作", emoji: "🐙", description: "透過 gh CLI 管理 Issues、PR、CI" },
      { name: "gog", label: "Google 工具", emoji: "📧", description: "Gmail、日曆、雲端硬碟、試算表、文件" },
      { name: "healthcheck", label: "資安檢查", emoji: "🔒", description: "主機資安強化與風險評估" },
      { name: "skill-creator", label: "技能建立器", emoji: "🛠️", description: "建立或更新 Agent 技能套件" },
      { name: "ui-ux-pro-max", label: "UI/UX 設計", emoji: "🎨", description: "AI 驅動的設計系統產生器" },
      { name: "video-frames", label: "影片擷取", emoji: "🎬", description: "從影片中擷取畫面或短片段" },
      { name: "weather", label: "天氣查詢", emoji: "🌤️", description: "查詢天氣與天氣預報" },
      { name: "ai-ppt-generator", label: "AI 簡報產生器", emoji: "📊", description: "產生專業 PowerPoint 簡報" }
    ];

    this.router.get('/skills', (req, res) => {
      res.json(SKILLS_LIST);
    });

    // Helper: read OpenClaw gateway config
    const getGatewayConfig = () => {
      try {
        const configPath = path.join(homedir(), '.openclaw', 'openclaw.json');
        return JSON.parse(readFileSync(configPath, 'utf-8'));
      } catch { return null; }
    };

    // Helper: Connect to OpenClaw Gateway via WebSocket JSON-RPC
    const sendToOpenClaw = async (message, timeoutMs = 120000) => {
      const config = getGatewayConfig();
      const token = config?.gateway?.auth?.token;
      if (!token) throw new Error('No gateway token');

      const { default: WebSocket } = await import('ws');
      return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:18789/ws', { headers: { 'Origin': 'http://localhost:18789', 'Host': 'localhost:18789' } });
        const timer = setTimeout(() => { ws.close(); reject(new Error('Gateway timeout')); }, timeoutMs);
        let connected = false;
        let chatRunId = null;
        let streamedText = '';
        let gotAssistantDelta = false;
        let reqId = null;

        ws.on('open', () => { /* wait for challenge */ });

        ws.on('message', (raw) => {
          try {
            const data = JSON.parse(raw.toString());
            
            // Step 1: Handle connect.challenge - respond with connect
            if (data.type === 'event' && data.event === 'connect.challenge') {
              ws.send(JSON.stringify({
                type: 'req',
                id: 'connect-1',
                method: 'connect',
                params: {
                  minProtocol: 3,
                  maxProtocol: 3,
                  client: { id: 'webchat', version: '1.0.0', platform: 'node', mode: 'webchat', instanceId: 'dashboard-' + Date.now() },
                  role: 'operator',
                  scopes: ['operator.admin'],
                  auth: { token },
                  userAgent: 'openclaw-dashboard/1.0'
                }
              }));
              return;
            }

            // Step 2: Handle connect response - then send chat message
            if (data.type === 'res' && data.id === 'connect-1') {
              if (!data.ok) {
                clearTimeout(timer);
                ws.close();
                return reject(new Error('Gateway auth failed: ' + (data.error?.message || 'unknown')));
              }
              connected = true;
              reqId = 'chat-' + Date.now();
              // Track the runId from chat events
              chatRunId = null;
              // Use main session - the agent processes requests here
              const dashSessionKey = 'agent:main:main';
              const idempotencyKey = `dash-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
              ws.send(JSON.stringify({
                type: 'req',
                id: reqId,
                method: 'chat.send',
                params: {
                  sessionKey: dashSessionKey,
                  message,
                  deliver: false,
                  idempotencyKey
                }
              }));
              return;
            }

            // Step 3: Handle chat.send response
            if (data.type === 'res' && data.id === reqId) {
              console.log('[Chat WS] chat.send response:', data.ok ? 'OK' : 'FAIL', JSON.stringify(data.error || ''));
              if (!data.ok) {
                clearTimeout(timer);
                ws.close();
                reject(new Error('chat.send failed: ' + (data.error?.message || 'unknown')));
              }
              return;
            }
            
            // Log all events for debugging
            if (data.type === 'event') {
              console.log('[Chat WS] event:', data.event, data.payload?.state || '', data.payload?.sessionKey || '');
            }

            // Step 4: Collect chat stream events
            if (data.type === 'event' && data.event === 'chat') {
              const payload = data.payload;
              if (payload?.sessionKey !== 'agent:main:main') return;
              
              if (payload?.state === 'delta') {
                // Extract accumulated text from delta - text is cumulative in each delta
                const content = payload?.message?.content;
                if (Array.isArray(content)) {
                  const textParts = content.filter(c => c.type === 'text').map(c => c.text);
                  if (textParts.length > 0) {
                    streamedText = textParts.join('');
                    gotAssistantDelta = true;
                  }
                }
              } else if (payload?.state === 'final' && gotAssistantDelta) {
                // Only resolve when we've received actual assistant content
                clearTimeout(timer);
                ws.close();
                resolve(streamedText || '任務已完成。');
                return;
              } else if (payload?.state === 'error') {
                clearTimeout(timer);
                ws.close();
                reject(new Error(payload?.errorMessage || 'Chat error'));
                return;
              }
              // Ignore 'final' without assistant content (that's just the user message ack)
            }

          } catch (e) {
            console.log('[Chat WS] Parse error:', e.message);
          }
        });

        ws.on('error', (err) => { clearTimeout(timer); reject(err); });
        ws.on('close', () => { clearTimeout(timer); });
      });
    };

    this.router.post('/chat/send', async (req, res) => {
      const { skill, message } = req.body;
      if (!skill || !message) {
        return res.status(400).json({ error: 'Missing skill or message' });
      }

      const skillInfo = SKILLS_LIST.find(s => s.name === skill);
      const taskId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      chatTasks[taskId] = { status: 'running', skill, message, startedAt: Date.now(), result: null };

      // Store user message in history
      chatHistory.push({ role: 'user', content: message, skill, timestamp: Date.now() });
      if (chatHistory.length > 100) chatHistory.shift();

      // Send to OpenClaw gateway via WebSocket and wait for response
      (async () => {
        try {
          const prompt = `請使用 ${skillInfo?.label || skill} 技能來完成以下需求：${message}`;
          console.log(`[Chat] Sending to OpenClaw: skill=${skill}, taskId=${taskId}`);
          
          const result = await sendToOpenClaw(prompt, 120000);

          chatTasks[taskId].status = 'completed';
          chatTasks[taskId].result = result;
          console.log(`[Chat] Task ${taskId} completed, result length: ${result.length}`);

          chatHistory.push({ role: 'assistant', content: result, skill, timestamp: Date.now() });
          if (chatHistory.length > 100) chatHistory.shift();
        } catch (err) {
          console.log(`[Chat] Task ${taskId} error:`, err.message);
          chatTasks[taskId].status = 'error';
          chatTasks[taskId].result = `❌ 執行失敗：${err.message}\n\n請確認 OpenClaw Gateway 正在運行中。`;
          chatHistory.push({ role: 'assistant', content: chatTasks[taskId].result, skill, timestamp: Date.now() });
        }
      })();

      res.json({ taskId, status: 'running' });
    });

    this.router.get('/chat/status/:taskId', (req, res) => {
      const task = chatTasks[req.params.taskId];
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Timeout after 2 minutes
      if (task.status === 'running' && Date.now() - task.startedAt > 120000) {
        task.status = 'error';
        task.result = '⏰ 任務執行逾時，請稍後再試。';
      }

      res.json({ taskId: req.params.taskId, status: task.status, result: task.result, skill: task.skill });
    });

    this.router.get('/chat/history', (req, res) => {
      res.json(chatHistory);
    });

    // SSE for real-time updates
    this.router.get('/stream', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      sendEvent({ type: 'connected', timestamp: Date.now() });

      const interval = setInterval(() => {
        sendEvent({ type: 'heartbeat', timestamp: Date.now() });
      }, 30000);

      // Also send last agent data update if exists
      if (bridgeCache.lastAgentDataUpdate) {
        sendEvent({ 
          type: 'agent-data-updated', 
          timestamp: bridgeCache.lastAgentDataUpdate,
          agents: bridgeCache.agents
        });
      }

      // Store this client's sendEvent for broadcasting
      if (!global.sseClients) global.sseClients = [];
      global.sseClients.push(sendEvent);

      // Setup global broadcast function
      global.broadcastAgentUpdate = (data) => {
        if (global.sseClients) {
          global.sseClients.forEach(client => {
            try {
              client(data);
            } catch (e) {
              console.log('[SSE] Client error:', e.message);
            }
          });
        }
      };

      req.on('close', () => {
        clearInterval(interval);
        if (global.sseClients) {
          global.sseClients = global.sseClients.filter(c => c !== sendEvent);
        }
      });
    });
  }
}
