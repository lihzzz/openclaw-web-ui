import fs from "fs";
import path from "path";
import { OPENCLAW_HOME } from "./openclaw-paths.js";

export interface SessionRecord {
  key: string;
  type: string;
  target: string;
  sessionId: string | null;
  updatedAt: number;
  totalTokens: number;
  contextTokens: number;
  systemSent: boolean;
}

export function parseSessionType(key: string): { type: string; target: string } {
  if (key.endsWith(":main")) {
    return { type: "main", target: "" };
  }
  if (key.includes(":feishu:direct:")) {
    return { type: "feishu-dm", target: key.split(":feishu:direct:")[1] };
  }
  if (key.includes(":feishu:group:")) {
    return { type: "feishu-group", target: key.split(":feishu:group:")[1] };
  }
  if (key.includes(":discord:direct:")) {
    return { type: "discord-dm", target: key.split(":discord:direct:")[1] };
  }
  if (key.includes(":discord:channel:")) {
    return { type: "discord-channel", target: key.split(":discord:channel:")[1] };
  }
  if (key.includes(":telegram:direct:")) {
    return { type: "telegram-dm", target: key.split(":telegram:direct:")[1] };
  }
  if (key.includes(":telegram:group:")) {
    return { type: "telegram-group", target: key.split(":telegram:group:")[1] };
  }
  if (key.includes(":telegram:slash:")) {
    return { type: "telegram-slash", target: key.split(":telegram:slash:")[1] };
  }
  if (key.startsWith("telegram:")) {
    return { type: "telegram", target: key.replace("telegram:", "") };
  }
  if (key.includes(":whatsapp:direct:")) {
    return { type: "whatsapp-dm", target: key.split(":whatsapp:direct:")[1] };
  }
  if (key.includes(":whatsapp:group:")) {
    return { type: "whatsapp-group", target: key.split(":whatsapp:group:")[1] };
  }
  if (key.includes(":qqbot:direct:")) {
    return { type: "qqbot-dm", target: key.split(":qqbot:direct:")[1] };
  }
  if (key.includes(":qqbot:group:")) {
    return { type: "qqbot-group", target: key.split(":qqbot:group:")[1] };
  }
  if (key.includes(":cron:")) {
    return { type: "cron", target: key.split(":cron:")[1] };
  }
  if (/^agent:[^:]+:[a-f0-9]{32}$/.test(key)) {
    return { type: "api", target: key.split(":").pop() || "" };
  }
  if (/^agent:[^:]+:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key)) {
    return { type: "api", target: key.split(":").pop() || "" };
  }
  return { type: "unknown", target: "" };
}

export function listAgentSessions(agentId: string): SessionRecord[] {
  const sessionsPath = path.join(OPENCLAW_HOME, `agents/${agentId}/sessions/sessions.json`);
  if (!fs.existsSync(sessionsPath)) {
    return [];
  }

  const raw = fs.readFileSync(sessionsPath, "utf-8");
  const sessions = JSON.parse(raw);
  if (!sessions || typeof sessions !== "object") {
    return [];
  }

  const list = Object.entries(sessions).map(([key, value]: [string, any]) => {
    const parsed = parseSessionType(key);
    return {
      key,
      type: parsed.type,
      target: parsed.target,
      sessionId: value?.sessionId || null,
      updatedAt: value?.updatedAt || 0,
      totalTokens: value?.totalTokens || 0,
      contextTokens: value?.contextTokens || 0,
      systemSent: value?.systemSent || false,
    };
  });

  list.sort((a, b) => b.updatedAt - a.updatedAt);
  return list;
}
