import chalk from 'chalk';
import figlet from 'figlet';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { DataStore } from './datastore.js';

class TUI {
  constructor(datastore) {
    this.datastore = datastore;
    this.currentScreen = 'main';
    this.selectedTask = null;
  }

  async start() {
    console.clear();
    this.printHeader();
    await this.mainMenu();
  }

  printHeader() {
    console.log(chalk.blue(figlet.textSync('OpenClaw', { font: 'Standard' })));
    console.log(chalk.gray('═'.repeat(50)));
    console.log(chalk.cyan('  Agent 團隊監控 - 終端機介面'));
    console.log(chalk.gray('═'.repeat(50)));
    console.log();
  }

  async mainMenu() {
    const stats = this.datastore.getStats();
    
    this.printStats(stats);
    this.printAgentsTable();
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: chalk.cyan('請選擇操作:'),
        choices: [
          { name: '📊 查看所有報告', value: 'reports' },
          { name: '📋 查看任務佇列', value: 'tasks' },
          { name: '🔍 查看 Agent 工作階段', value: 'sessions' },
          { name: '➕ 建立 Agent 團隊任務', value: 'create' },
          { name: '⚙️  設定', value: 'settings' },
          { name: '🔄 重新整理', value: 'refresh' },
          { name: '❌ 離開', value: 'exit' }
        ]
      }
    ]);

    switch (action) {
      case 'reports':
        await this.showReports();
        break;
      case 'tasks':
        await this.showTasks();
        break;
      case 'sessions':
        await this.showSessions();
        break;
      case 'create':
        await this.createTask();
        break;
      case 'settings':
        await this.showSettings();
        break;
      case 'refresh':
        await this.mainMenu();
        return;
      case 'exit':
        console.log(chalk.yellow('再見!'));
        process.exit(0);
        return;
    }

    await this.mainMenu();
  }

  printStats(stats) {
    const table = new Table({
      head: [],
      colWidths: [20, 15, 15, 15, 15],
      style: { compact: true }
    });

    table.push(
      [
        chalk.gray('作用中階段'),
        chalk.blue(stats.activeSessions)
      ],
      [
        chalk.gray('執行中任務'),
        chalk.yellow(stats.activeTasks)
      ],
      [
        chalk.gray('已完成'),
        chalk.green(stats.completedTasks)
      ],
      [
        chalk.gray('報告總數'),
        chalk.magenta(stats.totalReports)
      ]
    );

    console.log(table.toString());
    console.log();
  }

  printAgentsTable() {
    const sessions = this.datastore.getSessions().slice(0, 10);
    
    if (sessions.length === 0) {
      console.log(chalk.gray('沒有作用中的 Agents'));
      console.log();
      return;
    }

    const table = new Table({
      head: [
        chalk.gray('狀態'),
        chalk.gray('名稱'),
        chalk.gray('模型'),
        chalk.gray('訊息'),
        chalk.gray('更新時間')
      ],
      colWidths: [12, 30, 20, 10, 15],
      style: { compact: true }
    });

    for (const session of sessions) {
      const statusColor = session.status === 'active' ? chalk.green : 
                         session.status === 'processing' ? chalk.yellow : 
                         chalk.gray;
      
      table.push([
        statusColor('●') + ' ' + this.getStatusText(session.status),
        session.name?.substring(0, 28) || '未命名',
        session.model?.substring(0, 18) || 'unknown',
        session.messages || 0,
        this.formatTimeAgo(session.updatedAt)
      ]);
    }

    console.log(chalk.cyan('作用中的 Agents:'));
    console.log(table.toString());
    console.log();
  }

  async showReports() {
    console.clear();
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.cyan('  完成報告'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log();

    const reports = this.datastore.getReports();

    if (reports.length === 0) {
      console.log(chalk.gray('目前沒有報告'));
    } else {
      for (const report of reports.slice(0, 20)) {
        console.log(chalk.white('─'.repeat(50)));
        console.log(chalk.bold.white(report.title || '未命名報告'));
        console.log(chalk.gray(`狀態: ${report.status === 'success' ? '成功' : '失敗'}`));
        console.log(chalk.gray(`建立時間: ${this.formatDate(report.createdAt)}`));
        console.log();
        console.log(chalk.gray('摘要:'));
        console.log(chalk.white(report.summary || '無摘要'));
        console.log();
        
        if (report.details) {
          console.log(chalk.gray('詳細資訊:'));
          console.log(chalk.gray(JSON.stringify(report.details, null, 2)));
          console.log();
        }
      }
    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按 Enter 繼續...' }]);
  }

  async showTasks() {
    console.clear();
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.cyan('  任務佇列'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log();

    const tasks = this.datastore.getTasks();

    if (tasks.length === 0) {
      console.log(chalk.gray('沒有任務'));
    } else {
      const table = new Table({
        head: [
          chalk.gray('ID'),
          chalk.gray('任務'),
          chalk.gray('狀態'),
          chalk.gray('Agents'),
          chalk.gray('建立時間')
        ],
        colWidths: [20, 35, 15, 20, 20],
        style: { compact: true }
      });

      for (const task of tasks) {
        table.push([
          task.id?.substring(0, 18) || 'N/A',
          task.task?.substring(0, 33) || '未命名',
          this.colorStatusText(task.status),
          (task.agents || []).join(', ').substring(0, 18) || 'default',
          this.formatTimeAgo(task.createdAt)
        ]);
      }

      console.log(table.toString());
    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按 Enter 繼續...' }]);
  }

  async showSessions() {
    console.clear();
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.cyan('  Agent 工作階段'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log();

    const sessions = this.datastore.getSessions();

    if (sessions.length === 0) {
      console.log(chalk.gray('沒有工作階段'));
    } else {
      const table = new Table({
        head: [
          chalk.gray('ID'),
          chalk.gray('名稱'),
          chalk.gray('狀態'),
          chalk.gray('模型'),
          chalk.gray('工具'),
          chalk.gray('更新時間')
        ],
        colWidths: [20, 25, 12, 18, 20, 15],
        style: { compact: true }
      });

      for (const session of sessions) {
        table.push([
          session.id?.substring(0, 18) || 'N/A',
          session.name?.substring(0, 23) || '未命名',
          this.colorStatusText(session.status),
          session.model?.substring(0, 16) || 'unknown',
          (session.tools || []).length.toString(),
          this.formatTimeAgo(session.updatedAt)
        ]);
      }

      console.log(table.toString());
    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按 Enter 繼續...' }]);
  }

  async createTask() {
    console.clear();
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.cyan('  建立 Agent 團隊任務'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log();

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'task',
        message: chalk.cyan('任務描述:'),
        validate: (input) => input.trim().length > 0
      },
      {
        type: 'checkbox',
        name: 'agents',
        message: chalk.cyan('選擇 Agents:'),
        choices: [
          { name: '💻 程式碼 Agent', value: 'coder', checked: true },
          { name: '🔍 研究 Agent', value: 'researcher', checked: true },
          { name: '🧪 測試 Agent', value: 'tester', checked: true },
          { name: '🚀 部署 Agent', value: 'deployer' }
        ]
      }
    ]);

    const task = {
      id: `team_${Date.now()}`,
      task: answers.task,
      agents: answers.agents,
      workflow: ['analyze', 'implement', 'test', 'report'],
      status: 'pending',
      createdAt: Date.now()
    };

    this.datastore.saveTask(task);

    console.log();
    console.log(chalk.green('✓ 任務建立成功!'));
    console.log(chalk.gray(`任務 ID: ${task.id}`));
    console.log();

    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按 Enter 繼續...' }]);
  }

  async showSettings() {
    console.clear();
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.cyan('  設定'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log();

    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'notifications',
        message: '啟用桌面通知?',
        default: true
      },
      {
        type: 'confirm',
        name: 'sound',
        message: '啟用聲音提醒?',
        default: false
      }
    ]);

    console.log();
    console.log(chalk.green('設定已儲存!'));
    console.log();

    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按 Enter 繼續...' }]);
  }

  colorStatus(status) {
    const colors = {
      'active': chalk.green,
      'running': chalk.yellow,
      'processing': chalk.yellow,
      'completed': chalk.blue,
      'success': chalk.green,
      'failed': chalk.red,
      'pending': chalk.gray,
      'idle': chalk.gray
    };
    return (colors[status] || chalk.gray)(status);
  }

  colorStatusText(status) {
    const texts = {
      'active': '作用中',
      'running': '執行中',
      'processing': '處理中',
      'completed': '已完成',
      'success': '成功',
      'failed': '失敗',
      'pending': '待處理',
      'idle': '閒置'
    };
    return (texts[status] || status);
  }

  getStatusText(status) {
    const texts = {
      'active': '作用中',
      'running': '執行中',
      'processing': '處理中',
      'completed': '已完成',
      'success': '成功',
      'failed': '失敗',
      'pending': '待處理',
      'idle': '閒置'
    };
    return texts[status] || status;
  }

  formatTimeAgo(timestamp) {
    if (!timestamp) return 'N/A';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return '剛剛';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分鐘前`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}小時前`;
    return `${Math.floor(seconds / 86400)}天前`;
  }

  formatDate(timestamp) {
    if (!timestamp) return '未知';
    return new Date(timestamp).toLocaleString('zh-TW');
  }
}

export { TUI };
