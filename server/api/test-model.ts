import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { OPENCLAW_HOME } from '../lib/openclaw-paths.js';

const router = Router();

const DEFAULT_MODEL_PROBE_TIMEOUT_MS = 15000;

type ProviderApiType = "anthropic-messages" | "openai-completions" | string;

interface ProviderConfig {
  baseUrl?: string;
  apiKey?: string;
  api?: ProviderApiType;
  authHeader?: boolean | string;
  headers?: Record<string, string>;
}

interface ModelProbeOutcome {
  ok: boolean;
  elapsed: number;
  model: string;
  mode: "api_key" | "oauth" | "unknown" | string;
  status: string;
  error?: string;
  text?: string;
  source: "direct_model_probe" | "openclaw_provider_probe";
  precision: "model" | "provider";
}

function stripUtf8Bom(text: string): string {
  return text.replace(/^\uFEFF/, "");
}

function readJsonFileSync<T = unknown>(filePath: string): T {
  return JSON.parse(stripUtf8Bom(fs.readFileSync(filePath, "utf-8"))) as T;
}

const MODELS_PATH = path.join(OPENCLAW_HOME, "agents", "main", "agent", "models.json");

function loadProviderConfig(providerId: string): ProviderConfig | null {
  try {
    const parsed = readJsonFileSync<Record<string, unknown>>(MODELS_PATH);
    const providers = parsed?.providers as Record<string, ProviderConfig> | undefined;
    if (!providers || typeof providers !== "object") return null;
    const exact = providers[providerId];
    if (exact && typeof exact === "object") return exact as ProviderConfig;
    const normalizedTarget = providerId.toLowerCase();
    for (const [key, value] of Object.entries(providers)) {
      if (key.toLowerCase() === normalizedTarget && value && typeof value === "object") {
        return value as ProviderConfig;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function pickAuthHeader(providerCfg: ProviderConfig, apiKey: string): Record<string, string> {
  const out: Record<string, string> = {};
  const authHeader = providerCfg.authHeader;
  const api = providerCfg.api;

  if (typeof authHeader === "string" && authHeader.trim()) {
    out[authHeader.trim()] = apiKey;
    return out;
  }

  if (authHeader === false) {
    out["x-api-key"] = apiKey;
    return out;
  }

  if (api === "anthropic-messages") {
    out["x-api-key"] = apiKey;
    out["Authorization"] = `Bearer ${apiKey}`;
    return out;
  }

  out["Authorization"] = `Bearer ${apiKey}`;
  return out;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

function classifyErrorStatus(httpStatus: number, errorText: string): string {
  const normalized = errorText.toLowerCase();
  if (normalized.includes("timed out")) return "timeout";
  if (normalized.includes("model_not_supported")) return "model_not_supported";
  if (httpStatus === 401 || httpStatus === 403 || normalized.includes("unauthorized")) return "auth";
  if (httpStatus === 429 || normalized.includes("rate limit")) return "rate_limit";
  if (httpStatus === 402 || normalized.includes("billing")) return "billing";
  return "error";
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  const p = payload as Record<string, unknown>;
  const direct = (p?.error as Record<string, unknown>)?.message || p?.message || p?.error;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return fallback;
}

async function probeModelDirect(params: { providerId: string; modelId: string; timeoutMs?: number }): Promise<ModelProbeOutcome | null> {
  const providerCfg = loadProviderConfig(params.providerId);
  if (!providerCfg?.baseUrl || !providerCfg.api || !providerCfg.apiKey) return null;

  const timeoutMs = params.timeoutMs ?? DEFAULT_MODEL_PROBE_TIMEOUT_MS;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(providerCfg.headers || {}),
    ...pickAuthHeader(providerCfg, providerCfg.apiKey),
  };

  if (providerCfg.api === "anthropic-messages") {
    if (!headers["anthropic-version"]) headers["anthropic-version"] = "2023-06-01";
    const url = `${providerCfg.baseUrl.replace(/\/+$/, "")}/v1/messages`;
    const body = {
      model: params.modelId,
      max_tokens: 8,
      messages: [{ role: "user", content: "Reply with OK." }],
    };
    const start = Date.now();
    try {
      const resp = await fetchWithTimeout(url, { method: "POST", headers, body: JSON.stringify(body) }, timeoutMs);
      const elapsed = Date.now() - start;
      if (resp.ok) {
        return {
          ok: true,
          elapsed,
          status: "ok",
          mode: "api_key",
          source: "direct_model_probe",
          precision: "model",
          text: "OK (direct model probe)",
          model: `${params.providerId}/${params.modelId}`,
        };
      }
      let payload: unknown = null;
      try { payload = await resp.json(); } catch {}
      const error = extractErrorMessage(payload, `HTTP ${resp.status}`);
      return {
        ok: false,
        elapsed,
        status: classifyErrorStatus(resp.status, error),
        error,
        mode: "api_key",
        source: "direct_model_probe",
        precision: "model",
        model: `${params.providerId}/${params.modelId}`,
      };
    } catch (err: unknown) {
      const elapsed = Date.now() - start;
      const e = err as Error & { name?: string };
      const isTimeout = e?.name === "AbortError";
      return {
        ok: false,
        elapsed,
        status: isTimeout ? "timeout" : "network",
        error: isTimeout ? "LLM request timed out." : (e?.message || "Network error"),
        mode: "api_key",
        source: "direct_model_probe",
        precision: "model",
        model: `${params.providerId}/${params.modelId}`,
      };
    }
  }

  if (providerCfg.api === "openai-completions") {
    const url = `${providerCfg.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const body = {
      model: params.modelId,
      messages: [{ role: "user", content: "Reply with OK." }],
      max_tokens: 8,
      temperature: 0,
    };
    const start = Date.now();
    try {
      const resp = await fetchWithTimeout(url, { method: "POST", headers, body: JSON.stringify(body) }, timeoutMs);
      const elapsed = Date.now() - start;
      if (resp.ok) {
        return {
          ok: true,
          elapsed,
          status: "ok",
          mode: "api_key",
          source: "direct_model_probe",
          precision: "model",
          text: "OK (direct model probe)",
          model: `${params.providerId}/${params.modelId}`,
        };
      }
      let payload: unknown = null;
      try { payload = await resp.json(); } catch {}
      const error = extractErrorMessage(payload, `HTTP ${resp.status}`);
      return {
        ok: false,
        elapsed,
        status: classifyErrorStatus(resp.status, error),
        error,
        mode: "api_key",
        source: "direct_model_probe",
        precision: "model",
        model: `${params.providerId}/${params.modelId}`,
      };
    } catch (err: unknown) {
      const elapsed = Date.now() - start;
      const e = err as Error & { name?: string };
      const isTimeout = e?.name === "AbortError";
      return {
        ok: false,
        elapsed,
        status: isTimeout ? "timeout" : "network",
        error: isTimeout ? "LLM request timed out." : (e?.message || "Network error"),
        mode: "api_key",
        source: "direct_model_probe",
        precision: "model",
        model: `${params.providerId}/${params.modelId}`,
      };
    }
  }

  return null;
}

router.post('/', async (req, res) => {
  try {
    const { provider: providerIdRaw, modelId: modelIdRaw } = req.body;
    const providerId = String(providerIdRaw || "").trim();
    const modelId = String(modelIdRaw || "").trim();
    if (!providerId || !modelId) {
      return res.status(400).json({ error: "Missing provider or modelId" });
    }

    const result = await probeModelDirect({ providerId, modelId });

    if (result) {
      return res.json(result);
    }

    // 如果没有直接探测结果，返回未知状态
    return res.json({
      ok: false,
      elapsed: 0,
      model: `${providerId}/${modelId}`,
      mode: "unknown",
      status: "unknown",
      error: "Provider configuration not found or unsupported API type",
      source: "direct_model_probe" as const,
      precision: "provider" as const,
    });
  } catch (err: unknown) {
    const e = err as Error;
    return res.status(500).json({
      ok: false,
      error: e.message || "Probe failed",
      elapsed: 0
    });
  }
});

export default router;