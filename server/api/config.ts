import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getConfigCache, setConfigCache } from '../lib/config-cache.js';
import { OPENCLAW_HOME, OPENCLAW_CONFIG_PATH } from '../lib/openclaw-paths.js';

const router = Router();
const CACHE_TTL_MS = 30_000;

interface SessionStatus {
  lastActive: number | null;
  totalTokens: number;
  contextTokens: number;
  sessionCount: number;
  todayAvgResponseMs: number;
  messageCount: number;
  weeklyResponseMs: number[];
  weeklyTokens: number[];
}

function getAgentSessionStatus(agentId: string): SessionStatus {
  const result: SessionStatus = {
    lastActive: null, totalTokens: 0, contextTokens: 0, sessionCount: 0,
    todayAvgResponseMs: 0, messageCount: 0, weeklyResponseMs: [], weeklyTokens: []
  };
  const sessionsDir = path.join(OPENCLAW_HOME, `agents/${agentId}/sessions`);

  const today = new Date().toISOString().slice(0, 10);
  const weekDates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    weekDates.push(d.toISOString().slice(0, 10));
  }
  const dailyResponseTimes: Record<string, number[]> = {};
  const dailyTokens: Record<string, number> = {};
  for (const d of weekDates) { dailyResponseTimes[d] = []; dailyTokens[d] = 0; }

  let files: string[];
  try {
    const allFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith(".jsonl") && !f.includes(".deleted."));
    const cutoff = Date.now() - 7 * 86400000;
    files = allFiles.filter(f => {
      try { return fs.statSync(path.join(sessionsDir, f)).mtimeMs >= cutoff; } catch { return false; }
    });
  } catch { return result; }

  const sessionKeys = new Set<string>();

  for (const file of files) {
    const filePath = path.join(sessionsDir, file);
    let content: string;
    try { content = fs.readFileSync(filePath, "utf-8"); } catch { continue; }

    const lines = content.trim().split("\n");
    const messages: { role: string; ts: string; stopReason?: string }[] = [];

    for (const line of lines) {
      let entry: any;
      try { entry = JSON.parse(line); } catch { continue; }

      if (entry.sessionKey) sessionKeys.add(entry.sessionKey);

      if (entry.type === "message" && entry.message) {
        const msg = entry.message;
        if (msg.role === "assistant" && msg.usage) {
          result.totalTokens += msg.usage.input || 0;
          result.totalTokens += msg.usage.output || 0;
          result.messageCount += 1;
          if (entry.timestamp) {
            const msgDate = entry.timestamp.slice(0, 10);
            if (dailyTokens[msgDate] !== undefined) {
              dailyTokens[msgDate] += (msg.usage.input || 0) + (msg.usage.output || 0);
            }
          }
        }
        if (entry.timestamp) {
          const ts = new Date(entry.timestamp).getTime();
          if (!result.lastActive || ts > result.lastActive) result.lastActive = ts;
          messages.push({ role: msg.role, ts: entry.timestamp, stopReason: msg.stopReason });
        }
      }
    }

    let lastUserTs: string | null = null;
    for (const msg of messages) {
      if (msg.role === "user") {
        lastUserTs = msg.ts;
      } else if (msg.role === "assistant" && msg.stopReason === "stop" && lastUserTs) {
        const msgDate = lastUserTs.slice(0, 10);
        if (dailyResponseTimes[msgDate]) {
          const diffMs = new Date(msg.ts).getTime() - new Date(lastUserTs).getTime();
          if (diffMs > 0 && diffMs < 600000) dailyResponseTimes[msgDate].push(diffMs);
        }
        lastUserTs = null;
      }
    }
  }

  result.sessionCount = sessionKeys.size || files.length;
  const todayTimes = dailyResponseTimes[today] || [];
  if (todayTimes.length > 0) {
    result.todayAvgResponseMs = Math.round(todayTimes.reduce((a, b) => a + b, 0) / todayTimes.length);
  }
  result.weeklyResponseMs = weekDates.map(d => {
    const times = dailyResponseTimes[d];
    if (!times || times.length === 0) return 0;
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  });
  result.weeklyTokens = weekDates.map(d => dailyTokens[d] || 0);
  return result;
}

function readIdentityName(agentId: string): string | null {
  const candidates = [
    path.join(OPENCLAW_HOME, `agents/${agentId}/agent/IDENTITY.md`),
    path.join(OPENCLAW_HOME, `workspace-${agentId}/IDENTITY.md`),
    agentId === "main" ? path.join(OPENCLAW_HOME, `workspace/IDENTITY.md`) : null,
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      const content = fs.readFileSync(p, "utf-8");
      const match = content.match(/\*\*Name:\*\*\s*(.+)/);
      if (match) {
        const name = match[1].trim();
        if (name && !name.startsWith("_") && !name.startsWith("(")) return name;
      }
    } catch {}
  }
  return null;
}

router.get('/', (req, res) => {
  const configCache = getConfigCache();
  if (configCache && Date.now() - configCache.ts < CACHE_TTL_MS) {
    return res.json(configCache.data);
  }

  try {
    const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw);

    const defaults = config.agents?.defaults || {};
    const defaultModel = typeof defaults.model === "string"
      ? defaults.model
      : defaults.model?.primary || "unknown";
    const fallbacks = typeof defaults.model === "object"
      ? defaults.model?.fallbacks || []
      : [];

    let agentList = config.agents?.list || [];
    const bindings = config.bindings || [];
    const channels = config.channels || {};
    const feishuAccounts = channels.feishu?.accounts || {};

    if (agentList.length === 0) {
      try {
        const agentsDir = path.join(OPENCLAW_HOME, "agents");
        const dirs = fs.readdirSync(agentsDir, { withFileTypes: true });
        agentList = dirs.filter(d => d.isDirectory() && !d.name.startsWith(".")).map(d => ({ id: d.name }));
      } catch {}
      if (agentList.length === 0) agentList = [{ id: "main" }];
    }

    const agents = agentList.map((agent: any) => {
      const id = agent.id;
      const identityName = readIdentityName(id);
      const name = identityName || agent.name || id;
      const emoji = agent.identity?.emoji || "🤖";
      const model = agent.model || defaultModel;

      const platforms: { name: string; accountId?: string; appId?: string; botOpenId?: string; botUserId?: string }[] = [];

      // Check feishu binding
      const feishuBinding = bindings.find((b: any) => b.agentId === id && b.match?.channel === "feishu");
      if (feishuBinding) {
        const accountId = feishuBinding.match?.accountId || id;
        const acc = feishuAccounts[accountId];
        platforms.push({ name: "feishu", accountId, appId: acc?.appId });
      } else if (feishuAccounts[id]) {
        const acc = feishuAccounts[id];
        platforms.push({ name: "feishu", accountId: id, appId: acc?.appId });
      }

      // Main agent gets all enabled channels
      if (id === "main") {
        for (const [channelName, cfg] of Object.entries(channels)) {
          if (channelName === "feishu") continue;
          if ((cfg as any)?.enabled !== false) {
            platforms.push({ name: channelName });
          }
        }
      }

      // Non-main agents get bound channels
      if (id !== "main") {
        const seenChannels = new Set<string>();
        for (const binding of bindings) {
          if (binding?.agentId !== id) continue;
          const channelName = binding?.match?.channel;
          if (!channelName || channelName === "feishu" || seenChannels.has(channelName)) continue;
          seenChannels.add(channelName);
          platforms.push({ name: channelName });
        }
      }

      return { id, name, emoji, model, platforms };
    });

    const agentsWithStatus = agents.map((agent: any) => ({
      ...agent,
      session: getAgentSessionStatus(agent.id),
    }));

    // Build providers
    const authProviderIds = new Set<string>();
    if (config.auth?.profiles) {
      for (const profileKey of Object.keys(config.auth.profiles)) {
        const profile = config.auth.profiles[profileKey];
        const providerId = profile?.provider || profileKey.split(":")[0];
        if (providerId) authProviderIds.add(providerId);
      }
    }

    let providers = Object.entries(config.models?.providers || {}).map(([providerId, provider]: [string, any]) => {
      const models = (provider.models || []).map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        contextWindow: m.contextWindow,
        maxTokens: m.maxTokens,
      }));

      const usedBy = agentsWithStatus
        .filter((a: any) => typeof a.model === "string" && a.model.startsWith(providerId + "/"))
        .map((a: any) => ({ id: a.id, emoji: a.emoji, name: a.name }));

      return {
        id: providerId,
        api: provider.api,
        accessMode: authProviderIds.has(providerId) ? "auth" : "api_key",
        models,
        usedBy,
      };
    });

    const data = {
      agents: agentsWithStatus,
      providers,
      defaults: { model: defaultModel, fallbacks },
      gateway: {
        port: config.gateway?.port || 18789,
        token: config.gateway?.auth?.token || "",
        host: config.gateway?.host || config.gateway?.hostname || "",
      },
    };

    setConfigCache({ data, ts: Date.now() });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;