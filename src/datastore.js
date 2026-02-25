import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use absolute path for data directory
const DATA_DIR = process.env.DATA_DIR || path.join(process.env.HOME || '/home/openclaw', 'data');

console.log('[DataStore] Using data directory:', DATA_DIR);

export class DataStore {
  constructor() {
    this.sessions = new Map();
    this.tasks = new Map();
    this.reports = new Map();
    this.initialize();
  }

  async initialize() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await this.loadData();
  }

  async loadData() {
    try {
      const sessionsFile = path.join(DATA_DIR, 'sessions.json');
      const data = await fs.readFile(sessionsFile, 'utf-8');
      const parsed = JSON.parse(data);
      
      this.sessions = new Map(Object.entries(parsed.sessions || {}));
      this.tasks = new Map(Object.entries(parsed.tasks || {}));
      this.reports = new Map(Object.entries(parsed.reports || {}));
    } catch {
      // First run, no data yet
    }
  }

  async saveData() {
    const data = {
      sessions: Object.fromEntries(this.sessions),
      tasks: Object.fromEntries(this.tasks),
      reports: Object.fromEntries(this.reports)
    };
    
    await fs.writeFile(
      path.join(DATA_DIR, 'sessions.json'),
      JSON.stringify(data, null, 2)
    );
  }

  saveSession(session) {
    this.sessions.set(session.id, {
      ...session,
      savedAt: Date.now()
    });
    this.saveData();
  }

  getSessions() {
    return Array.from(this.sessions.values()).sort((a, b) => 
      (b.updatedAt || 0) - (a.updatedAt || 0)
    );
  }

  getSession(id) {
    return this.sessions.get(id);
  }

  saveTask(task) {
    this.tasks.set(task.id, {
      ...task,
      savedAt: Date.now()
    });
    this.saveData();
  }

  getTasks() {
    return Array.from(this.tasks.values()).sort((a, b) => 
      (b.createdAt || 0) - (a.createdAt || 0)
    );
  }

  getTask(id) {
    return this.tasks.get(id);
  }

  getTasksByStatus(status) {
    return this.getTasks().filter(t => t.status === status);
  }

  saveReport(report) {
    this.reports.set(report.id, {
      ...report,
      savedAt: Date.now()
    });
    this.saveData();
  }

  getReports() {
    return Array.from(this.reports.values()).sort((a, b) => 
      (b.createdAt || 0) - (a.createdAt || 0)
    );
  }

  getReport(id) {
    return this.reports.get(id);
  }

  getStats() {
    const sessions = this.getSessions();
    const tasks = this.getTasks();
    const reports = this.getReports();
    
    const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'processing');
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const failedTasks = tasks.filter(t => t.status === 'failed');

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'active' || s.status === 'processing').length,
      totalTasks: tasks.length,
      activeTasks: activeTasks.length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      totalReports: reports.length,
      lastUpdate: Date.now()
    };
  }

  clearOldData(daysOld = 30) {
    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    
    for (const [id, session] of this.sessions) {
      if (session.updatedAt < cutoff) {
        this.sessions.delete(id);
      }
    }
    
    for (const [id, task] of this.tasks) {
      if (task.createdAt < cutoff) {
        this.tasks.delete(id);
      }
    }
    
    this.saveData();
  }
}
