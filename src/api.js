import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

      req.on('close', () => {
        clearInterval(interval);
      });
    });
  }
}
