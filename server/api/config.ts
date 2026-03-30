import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { getConfigCache, setConfigCache } from '../lib/config-cache.js';
import { getAgentStatus, statsCache } from '../lib/session-parser.js';
import { OPENCLAW_HOME, OPENCLAW_CONFIG_PATH } from '../lib/openclaw-paths.js';

const router = Router();
const CACHE_TTL_MS = 30_000;

/**
 * 异步读取 Identity 名称
 */
async function readIdentityName(agentId: string): Promise<string | null> {
  const candidates = [
    path.join(OPENCLAW_HOME, `agents/${agentId}/agent/IDENTITY.md`),
    path.join(OPENCLAW_HOME, `workspace-${agentId}/IDENTITY.md`),
    agentId === 'main' ? path.join(OPENCLAW_HOME, `workspace/IDENTITY.md`) : null,
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      const content = await fs.readFile(p, 'utf-8');
      const match = content.match(/\*\*Name:\*\*\s*(.+)/);
      if (match) {
        const name = match[1].trim();
        if (name && !name.startsWith('_') && !name.startsWith('(')) return name;
      }
    } catch {
      // 文件不存在或读取失败，继续尝试下一个
    }
  }
  return null;
}

/**
 * 异步扫描 Agent 列表
 */
async function scanAgentList(): Promise<Array<{ id: string; name?: string; identity?: { emoji?: string }; model?: string }>> {
  try {
    const agentsDir = path.join(OPENCLAW_HOME, 'agents');
    const entries = await fs.readdir(agentsDir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => ({ id: e.name }));
  } catch {
    return [{ id: 'main' }];
  }
}

router.get('/', async (req, res) => {
  const configCache = getConfigCache();
  if (configCache && Date.now() - configCache.ts < CACHE_TTL_MS) {
    return res.json(configCache.data);
  }

  try {
    // 异步读取配置文件
    const raw = await fs.readFile(OPENCLAW_CONFIG_PATH, 'utf-8');
    const config = JSON.parse(raw);

    const defaults = config.agents?.defaults || {};
    const defaultModel = typeof defaults.model === 'string'
      ? defaults.model
      : defaults.model?.primary || 'unknown';
    const fallbacks = typeof defaults.model === 'object'
      ? defaults.model?.fallbacks || []
      : [];

    let agentList = config.agents?.list || [];
    const bindings = config.bindings || [];
    const channels = config.channels || {};
    const feishuAccounts = channels.feishu?.accounts || {};

    // 如果配置中没有 Agent 列表，异步扫描目录
    if (agentList.length === 0) {
      agentList = await scanAgentList();
    }

    // 并行构建 Agent 信息
    const agents = await Promise.all(
      agentList.map(async (agent: any) => {
        const id = agent.id;
        const identityName = await readIdentityName(id);
        const name = identityName || agent.name || id;
        const emoji = agent.identity?.emoji || '🤖';
        const model = agent.model || defaultModel;

        const platforms: { name: string; accountId?: string; appId?: string; botOpenId?: string; botUserId?: string }[] = [];

        // Check feishu binding
        const feishuBinding = bindings.find((b: any) => b.agentId === id && b.match?.channel === 'feishu');
        if (feishuBinding) {
          const accountId = feishuBinding.match?.accountId || id;
          const acc = feishuAccounts[accountId];
          platforms.push({ name: 'feishu', accountId, appId: acc?.appId });
        } else if (feishuAccounts[id]) {
          const acc = feishuAccounts[id];
          platforms.push({ name: 'feishu', accountId: id, appId: acc?.appId });
        }

        // Main agent gets all enabled channels
        if (id === 'main') {
          for (const [channelName, cfg] of Object.entries(channels)) {
            if (channelName === 'feishu') continue;
            if ((cfg as any)?.enabled !== false) {
              platforms.push({ name: channelName });
            }
          }
        }

        // Non-main agents get bound channels
        if (id !== 'main') {
          const seenChannels = new Set<string>();
          for (const binding of bindings) {
            if (binding?.agentId !== id) continue;
            const channelName = binding?.match?.channel;
            if (!channelName || channelName === 'feishu' || seenChannels.has(channelName)) continue;
            seenChannels.add(channelName);
            platforms.push({ name: channelName });
          }
        }

        return { id, name, emoji, model, platforms };
      })
    );

    // 并行获取所有 Agent 状态（使用缓存）
    const agentsWithStatus = await Promise.all(
      agents.map(async (agent: any) => ({
        ...agent,
        session: await getAgentStatus(agent.id),
      }))
    );

    // Build providers
    const authProviderIds = new Set<string>();
    if (config.auth?.profiles) {
      for (const profileKey of Object.keys(config.auth.profiles)) {
        const profile = config.auth.profiles[profileKey];
        const providerId = profile?.provider || profileKey.split(':')[0];
        if (providerId) authProviderIds.add(providerId);
      }
    }

    const providers = Object.entries(config.models?.providers || {}).map(([providerId, provider]: [string, any]) => {
      const models = (provider.models || []).map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        contextWindow: m.contextWindow,
        maxTokens: m.maxTokens,
      }));

      const usedBy = agentsWithStatus
        .filter((a: any) => typeof a.model === 'string' && a.model.startsWith(providerId + '/'))
        .map((a: any) => ({ id: a.id, emoji: a.emoji, name: a.name }));

      return {
        id: providerId,
        api: provider.api,
        accessMode: authProviderIds.has(providerId) ? 'auth' : 'api_key',
        models,
        usedBy,
      };
    });

    // 支持通过环境变量配置外部访问地址
    const externalHost = process.env.GATEWAY_EXTERNAL_HOST || '';

    const data = {
      agents: agentsWithStatus,
      providers,
      defaults: { model: defaultModel, fallbacks },
      gateway: {
        port: config.gateway?.port || 18789,
        host: config.gateway?.host || config.gateway?.hostname || '',
        hasToken: Boolean(config.gateway?.auth?.token),
        externalHost,
      },
    };

    setConfigCache({ data, ts: Date.now() });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
