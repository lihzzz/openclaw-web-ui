import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { OPENCLAW_HOME } from '../lib/openclaw-paths.js';

const router = Router();

// Session type detection
function parseSessionType(key: string): { type: string; target: string } {
  if (key.endsWith(':main')) {
    return { type: 'main', target: '' };
  } else if (key.includes(':feishu:direct:')) {
    return { type: 'feishu-dm', target: key.split(':feishu:direct:')[1] };
  } else if (key.includes(':feishu:group:')) {
    return { type: 'feishu-group', target: key.split(':feishu:group:')[1] };
  } else if (key.includes(':discord:direct:')) {
    return { type: 'discord-dm', target: key.split(':discord:direct:')[1] };
  } else if (key.includes(':discord:channel:')) {
    return { type: 'discord-channel', target: key.split(':discord:channel:')[1] };
  } else if (key.includes(':telegram:direct:')) {
    return { type: 'telegram-dm', target: key.split(':telegram:direct:')[1] };
  } else if (key.includes(':telegram:group:')) {
    return { type: 'telegram-group', target: key.split(':telegram:group:')[1] };
  } else if (key.includes(':telegram:slash:')) {
    return { type: 'telegram-slash', target: key.split(':telegram:slash:')[1] };
  } else if (key.startsWith('telegram:')) {
    return { type: 'telegram', target: key.replace('telegram:', '') };
  } else if (key.includes(':whatsapp:direct:')) {
    return { type: 'whatsapp-dm', target: key.split(':whatsapp:direct:')[1] };
  } else if (key.includes(':whatsapp:group:')) {
    return { type: 'whatsapp-group', target: key.split(':whatsapp:group:')[1] };
  } else if (key.includes(':qqbot:direct:')) {
    return { type: 'qqbot-dm', target: key.split(':qqbot:direct:')[1] };
  } else if (key.includes(':qqbot:group:')) {
    return { type: 'qqbot-group', target: key.split(':qqbot:group:')[1] };
  } else if (key.includes(':cron:')) {
    return { type: 'cron', target: key.split(':cron:')[1] };
  } else if (/^agent:[^:]+:[a-f0-9]{32}$/.test(key)) {
    // UUID without dashes (32 hex chars)
    return { type: 'api', target: key.split(':').pop() || '' };
  } else if (/^agent:[^:]+:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key)) {
    // UUID with dashes (standard format)
    return { type: 'api', target: key.split(':').pop() || '' };
  }
  return { type: 'unknown', target: '' };
}

// GET /api/sessions/:agentId
router.get('/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;
    const sessionsPath = path.join(OPENCLAW_HOME, `agents/${agentId}/sessions/sessions.json`);

    if (!fs.existsSync(sessionsPath)) {
      return res.json({ agentId, sessions: [] });
    }

    const raw = fs.readFileSync(sessionsPath, 'utf-8');
    const sessions = JSON.parse(raw);

    const list = Object.entries(sessions).map(([key, val]: [string, any]) => {
      const { type, target } = parseSessionType(key);
      return {
        key,
        type,
        target,
        sessionId: val.sessionId || null,
        updatedAt: val.updatedAt || 0,
        totalTokens: val.totalTokens || 0,
        contextTokens: val.contextTokens || 0,
        systemSent: val.systemSent || false,
      };
    });

    // Sort by most recent activity
    list.sort((a, b) => b.updatedAt - a.updatedAt);

    res.json({ agentId, sessions: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;