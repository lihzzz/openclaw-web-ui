import { Router } from 'express';
import fs from 'fs';
import { OPENCLAW_CONFIG_PATH } from '../lib/openclaw-paths.js';
import { execOpenclaw, parseJsonFromMixedOutput } from '../lib/openclaw-cli.js';

const router = Router();

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
  if (parsed?.status === "ok") {
    const summary = typeof parsed?.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : "completed";
    return `OK (${summary}, CLI fallback)`;
  }
  return (stdout || "(no reply)").trim().slice(0, 200);
}

async function testSessionViaCli(agentId: string): Promise<{ ok: boolean; reply?: string; error?: string; elapsed: number }> {
  const startTime = Date.now();
  try {
    const { stdout, stderr } = await execOpenclaw([
      "agent",
      "--agent",
      agentId,
      "--message",
      "Health check: reply with OK",
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
    const elapsed = Date.now() - startTime;
    return { ok: false, error: (err?.message || "CLI fallback failed").slice(0, 300), elapsed };
  }
}

function shouldFallbackToCli(status: number, rawText: string): boolean {
  const text = rawText.trim();
  return status === 404 || text === "Not Found";
}

function parseApiJsonSafely(rawText: string): any {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

// POST /api/test-session
router.post('/', async (req, res) => {
  try {
    const { sessionKey, agentId } = req.body;
    if (!sessionKey || !agentId) {
      return res.status(400).json({ error: "Missing sessionKey or agentId" });
    }

    // Read gateway config
    const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8');
    const config = JSON.parse(raw);
    const gatewayPort = config.gateway?.port || 18789;
    const gatewayToken = config.gateway?.auth?.token || "";

    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${gatewayToken}`,
        "x-openclaw-agent-id": agentId,
        "x-openclaw-session-key": sessionKey,
      };

      const resp = await fetch(`http://127.0.0.1:${gatewayPort}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: `openclaw:${agentId}`,
          messages: [{ role: "user", content: "Health check: reply with OK" }],
          max_tokens: 64,
        }),
        signal: AbortSignal.timeout(100000),
      });
      const rawText = await resp.text();
      const data = parseApiJsonSafely(rawText);
      const elapsed = Date.now() - startTime;

      if (!resp.ok) {
        if (shouldFallbackToCli(resp.status, rawText)) {
          const fallback = await testSessionViaCli(agentId);
          return res.json({
            status: fallback.ok ? "ok" : "error",
            sessionKey,
            elapsed: fallback.elapsed,
            reply: fallback.reply,
            error: fallback.error,
          });
        }
        return res.json({
          status: "error",
          sessionKey,
          elapsed,
          error: data?.error?.message || rawText || JSON.stringify(data),
        });
      }

      const reply = data.choices?.[0]?.message?.content || "";
      return res.json({
        status: "ok",
        sessionKey,
        elapsed,
        reply: reply.slice(0, 200) || "(no reply)",
      });
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      const isTimeout = err.name === "TimeoutError" || err.name === "AbortError";
      return res.json({
        status: "error",
        sessionKey,
        elapsed,
        error: isTimeout ? "Timeout: agent not responding (100s)" : (err.message || "Unknown error").slice(0, 300),
      });
    }
  } catch (err: any) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

export default router;