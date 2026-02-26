import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { watch } from 'chokidar';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AgentCollector } from './collector.js';
import { DataStore } from './datastore.js';
import { NotificationService } from './notifier.js';
import { APIRouter } from './api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class OpenClawMonitor {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    this.datastore = new DataStore();
    this.collector = new AgentCollector(this.datastore);
    this.notifier = new NotificationService();
    this.port = 3847;
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupMiddleware() {
    this.app.use(express.json());
    
    // Serve React app from dist folder if exists, otherwise fallback to HTML
    const distPath = path.join(__dirname, '../web/dist');
    const staticPath = path.join(__dirname, '../web');
    
    // Check if React build exists
    if (fs.existsSync(path.join(distPath, 'index.html'))) {
      this.app.use(express.static(distPath));
      console.log('[Server] Serving React app from dist/');
    } else {
      this.app.use(express.static(staticPath));
      console.log('[Server] Serving static files from web/');
    }
    
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });
  }

  setupRoutes() {
    const api = new APIRouter(this.datastore, this.notifier, this.collector);
    this.app.use('/api', api.router);
    
    // Check if React build exists
    const distPath = path.join(__dirname, '../web/dist');
    const indexPath = path.join(distPath, 'index.html');
    
    if (fs.existsSync(indexPath)) {
      // React SPA: serve index.html for all non-API routes
      this.app.get('/api/*', (req, res) => res.status(404).json({ error: 'Not found' }));
      this.app.get('*', (req, res) => {
        res.sendFile(indexPath);
      });
    } else {
      // Fallback to old HTML dashboard
      this.app.get('/dashboard', (req, res) => {
        res.sendFile(path.join(__dirname, '../web/dashboard.html'));
      });
      
      this.app.get('/', (req, res) => {
        res.redirect('/dashboard');
      });
    }
  }

  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('[Monitor] Client connected');
      
      ws.send(JSON.stringify({
        type: 'connected',
        data: { timestamp: Date.now() }
      }));

      const heartbeat = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat', data: { timestamp: Date.now() } }));
        }
      }, 30000);

      ws.on('close', () => {
        clearInterval(heartbeat);
        console.log('[Monitor] Client disconnected');
      });
    });
  }

  broadcast(event) {
    const message = JSON.stringify(event);
    this.wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }

  async start() {
    await this.collector.start();
    await this.notifier.initialize();
    
    this.server.listen(this.port, () => {
      console.log(`\n🔵 OpenClaw Monitor Started`);
      console.log(`   Web Dashboard: http://localhost:${this.port}`);
      console.log(`   API Endpoint:  http://localhost:${this.port}/api\n`);
    });

    // Periodic refresh every 15 seconds to keep data fresh
    setInterval(async () => {
      await this.collector.collectAllData();
      this.broadcast({ type: 'refresh', data: { timestamp: Date.now() } });
    }, 15000);

    this.collector.on('agentUpdate', (data) => {
      this.broadcast({ type: 'agentUpdate', data });
    });

    this.collector.on('taskUpdate', (data) => {
      this.broadcast({ type: 'taskUpdate', data });
    });

    this.collector.on('taskComplete', async (data) => {
      this.broadcast({ type: 'taskComplete', data });
      await this.notifier.sendTaskComplete(data);
    });

    this.collector.on('error', (data) => {
      this.broadcast({ type: 'error', data });
      this.notifier.sendError(data);
    });
  }
}

const monitor = new OpenClawMonitor();
monitor.start().catch(console.error);
