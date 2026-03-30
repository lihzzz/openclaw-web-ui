import fs from "fs";
import path from "path";
import { OPENCLAW_CONFIG_PATH, OPENCLAW_HOME } from "./openclaw-paths.js";
import { execOpenclaw, parseJsonFromMixedOutput } from "./openclaw-cli.js";

export interface AgentHealthResult {
  ok: boolean;
  reply?: string;
  error?: string;
  elapsed: number;
}

interface GatewayRuntimeConfig {
  host: string;
  port: number;
  token: string;
}

const DEFAULT_TEST_PROMPT = "Health check: reply with OK";

function parseApiJsonSafely(rawText: string): any {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function shouldFallbackToCli(status: number, rawText: string): boolean {
  const text = rawText.trim();
  return status === 404 || text === "Not Found";
}

function extractCliReply(parsed: any, stdout: string): string {
  const candidates = [
    parsed?.reply,
    parsed?.text,
    parsed?.outputText,
    parsed?.result?.reply,
    parsed?.result?.text,
    parsed?.response?.text,
    parsed?.response?.output_text,
    parsed?.message,
  ];
  const hit = candidates.find((value) => typeof value === "string" && value.trim());
  if (hit) return hit.trim().slice(0, 200);
  if (parsed?.status === "ok") return "OK (CLI fallback)";
  return (stdout || "(no reply)").trim().slice(0, 200);
}

function readGatewayRuntimeConfig(): GatewayRuntimeConfig {
  try {
    const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw);
    return {
      host: config?.gateway?.host || config?.gateway?.hostname || "127.0.0.1",
      port: Number(config?.gateway?.port) || 18789,
      token: String(config?.gateway?.auth?.token || ""),
    };
  } catch {
    return {
      host: "127.0.0.1",
      port: 18789,
      token: "",
    };
  }
}

export function listAgentIds(): string[] {
  try {
    const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw);
    const agentList = Array.isArray(config?.agents?.list) ? config.agents.list : [];
    const ids = agentList
      .map((agent: any) => String(agent?.id || "").trim())
      .filter(Boolean);
    if (ids.length > 0) return Array.from(new Set(ids));
  } catch {
    // Fallback below.
  }

  try {
    const agentsDir = path.join(OPENCLAW_HOME, "agents");
    const ids = fs.readdirSync(agentsDir).filter((name) => {
      try {
        return fs.statSync(path.join(agentsDir, name)).isDirectory();
      } catch {
        return false;
      }
    });
    if (ids.length > 0) return ids;
  } catch {
    // Fallback below.
  }

  return ["main"];
}

async function testAgentViaCli(agentId: string, prompt: string): Promise<AgentHealthResult> {
  const startTime = Date.now();
  try {
    const { stdout, stderr } = await execOpenclaw([
      "agent",
      "--agent",
      agentId,
      "--message",
      prompt,
      "--json",
      "--timeout",
      "100",
    ]);
    const elapsed = Date.now() - startTime;
    const parsed = parseJsonFromMixedOutput(`${stdout}\n${stderr || ""}`);
    const error = parsed?.error?.message || parsed?.error;
    if (typeof error === "string" && error.trim()) {
      return { ok: false, error: error.trim().slice(0, 300), elapsed };
    }
    return { ok: true, reply: extractCliReply(parsed, stdout), elapsed };
  } catch (err: any) {
    return {
      ok: false,
      error: String(err?.message || "CLI fallback failed").slice(0, 300),
      elapsed: Date.now() - startTime,
    };
  }
}

export async function testAgentSession(
  agentId: string,
  sessionKey?: string,
  prompt = DEFAULT_TEST_PROMPT,
): Promise<AgentHealthResult> {
  const runtime = readGatewayRuntimeConfig();
  const startTime = Date.now();
  const actualSessionKey = sessionKey || `agent:${agentId}:main`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-openclaw-agent-id": agentId,
      "x-openclaw-session-key": actualSessionKey,
    };
    if (runtime.token) {
      headers.Authorization = `Bearer ${runtime.token}`;
    }

    const response = await fetch(`http://${runtime.host}:${runtime.port}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: `openclaw:${agentId}`,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 64,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(100000),
    });

    const rawText = await response.text();
    const data = parseApiJsonSafely(rawText);
    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      if (shouldFallbackToCli(response.status, rawText)) {
        return testAgentViaCli(agentId, prompt);
      }
      return {
        ok: false,
        elapsed,
        error: data?.error?.message || rawText || `HTTP ${response.status}`,
      };
    }

    const reply = data?.choices?.[0]?.message?.content || "";
    return {
      ok: true,
      elapsed,
      reply: String(reply || "(no reply)").slice(0, 200),
    };
  } catch (err: any) {
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    return {
      ok: false,
      elapsed: Date.now() - startTime,
      error: isTimeout ? "Timeout: agent not responding (100s)" : String(err?.message || "Unknown error"),
    };
  }
}
