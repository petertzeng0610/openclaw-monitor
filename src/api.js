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
