import fs from "fs";
import { OPENCLAW_CONFIG_PATH } from "./openclaw-paths.js";
import { listAgentIds } from "./agent-test.js";
import { listAgentSessions } from "./sessions.js";

export interface AgentPlatformPair {
  agentId: string;
  platform: string;
}

function platformFromSessionType(type: string): string | null {
  if (type.startsWith("feishu")) return "feishu";
  if (type.startsWith("discord")) return "discord";
  if (type.startsWith("telegram")) return "telegram";
  if (type.startsWith("whatsapp")) return "whatsapp";
  if (type.startsWith("qqbot")) return "qqbot";
  return null;
}

export function getConfiguredAgentPlatforms(): AgentPlatformPair[] {
  try {
    const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw);
    const agentList = Array.isArray(config?.agents?.list) ? config.agents.list : [];
    const bindings = Array.isArray(config?.bindings) ? config.bindings : [];
    const channels = config?.channels || {};
    const feishuAccounts = channels?.feishu?.accounts || {};

    const agentIds = agentList.length > 0
      ? agentList.map((agent: any) => String(agent?.id || "").trim()).filter(Boolean)
      : listAgentIds();

    const result: AgentPlatformPair[] = [];
    for (const agentId of agentIds) {
      const seen = new Set<string>();

      const hasFeishuBinding = bindings.some((binding: any) => {
        return binding?.agentId === agentId && binding?.match?.channel === "feishu";
      });
      if (hasFeishuBinding || feishuAccounts[agentId]) {
        seen.add("feishu");
      }

      if (agentId === "main") {
        for (const [channelName, cfg] of Object.entries(channels)) {
          if (channelName === "feishu") continue;
          if ((cfg as any)?.enabled !== false) {
            seen.add(channelName);
          }
        }
      } else {
        for (const binding of bindings) {
          if (binding?.agentId !== agentId) continue;
          const channelName = String(binding?.match?.channel || "").trim();
          if (!channelName || channelName === "feishu") continue;
          seen.add(channelName);
        }
      }

      for (const platform of seen) {
        result.push({ agentId, platform });
      }
    }

    if (result.length > 0) return result;
  } catch {
    // Fallback below.
  }

  const fallback: AgentPlatformPair[] = [];
  for (const agentId of listAgentIds()) {
    const seen = new Set<string>();
    for (const session of listAgentSessions(agentId)) {
      const platform = platformFromSessionType(session.type);
      if (platform) seen.add(platform);
    }
    for (const platform of seen) {
      fallback.push({ agentId, platform });
    }
  }
  return fallback;
}

export function findLatestPlatformSessionKey(agentId: string, platform: string): string | null {
  const sessions = listAgentSessions(agentId);
  for (const session of sessions) {
    if (platformFromSessionType(session.type) === platform) {
      return session.key;
    }
  }
  return null;
}

export function findLatestDmSessionKey(agentId: string, platform: string): string | null {
  const sessions = listAgentSessions(agentId);
  for (const session of sessions) {
    const type = session.type;
    if (platform === "feishu" && type === "feishu-dm") return session.key;
    if (platform === "discord" && type === "discord-dm") return session.key;
    if (platform === "telegram" && type === "telegram-dm") return session.key;
    if (platform === "whatsapp" && type === "whatsapp-dm") return session.key;
    if (platform === "qqbot" && type === "qqbot-dm") return session.key;
  }
  return null;
}
