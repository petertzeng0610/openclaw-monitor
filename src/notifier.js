import notifier from 'node-notifier';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class NotificationService {
  constructor() {
    this.enabled = true;
    this.pushSettings = null;
  }

  async initialize() {
    console.log('[Notifier] Notification service initialized');
  }

  async sendTaskComplete(data) {
    if (!this.enabled) return;

    const title = '✅ Agent Task Complete';
    const message = data.summary?.title || data.name || 'Task finished';
    
    this.sendDesktopNotification(title, message, 'completed');
  }

  async sendError(data) {
    if (!this.enabled) return;

    const title = '❌ Agent Error';
    const message = data.message || 'An error occurred';
    
    this.sendDesktopNotification(title, message, 'error');
  }

  sendDesktopNotification(title, message, type = 'info') {
    notifier.notify({
      title: `OpenClaw: ${title}`,
      message: message,
      sound: type === 'error',
      wait: false
    });
  }

  async sendPushNotification(title, message, settings) {
    if (!settings?.enabled) return;

    // Push notification via various services
    // Can be extended to support Pushover, Telegram, Discord, etc.
    
    if (settings.telegram?.enabled) {
      await this.sendTelegram(settings.telegram, title, message);
    }

    if (settings.pushover?.enabled) {
      await this.sendPushover(settings.pushover, title, message);
    }
  }

  async sendTelegram(config, title, message) {
    try {
      const axios = (await import('axios')).default;
      await axios.post(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
        chat_id: config.chatId,
        text: `*${title}*\n${message}`,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('[Notifier] Telegram error:', error.message);
    }
  }

  async sendPushover(config, title, message) {
    try {
      const axios = (await import('axios')).default;
      await axios.post('https://api.pushover.net/1/messages.json', {
        token: config.token,
        user: config.userKey,
        title: `OpenClaw: ${title}`,
        message: message
      });
    } catch (error) {
      console.error('[Notifier] Pushover error:', error.message);
    }
  }

  setPushSettings(settings) {
    this.pushSettings = settings;
  }

  disable() {
    this.enabled = false;
  }

  enable() {
    this.enabled = true;
  }
}
