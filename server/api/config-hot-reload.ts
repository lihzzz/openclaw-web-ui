import { Router } from 'express';
import fs from 'fs';
import { clearConfigCache } from '../lib/config-cache.js';
import { callOpenclawGateway, resolveConfigSnapshotHash } from '../lib/openclaw-cli.js';
import { OPENCLAW_CONFIG_PATH } from '../lib/openclaw-paths.js';

const router = Router();

const GATEWAY_CALL_TIMEOUT_MS = 15000;

type ConfigSnapshot = {
  valid?: boolean;
  hash?: string;
  raw?: string | null;
  config?: any;
};

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapGatewayResult<T>(payload: any): T {
  if (isPlainObject(payload) && "result" in payload) {
    return payload.result as T;
  }
  return payload as T;
}

function normalizeErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "Unknown error";
}

async function getConfigSnapshot(): Promise<ConfigSnapshot> {
  return unwrapGatewayResult<ConfigSnapshot>(
    await callOpenclawGateway("config.get", {}, GATEWAY_CALL_TIMEOUT_MS),
  );
}

/**
 * GET /api/config-hot-reload
 * Get current config from Gateway with hash for hot reload
 */
router.get('/', async (req, res) => {
  try {
    // Try to get config from Gateway first
    const snapshot = await getConfigSnapshot();
    const hash = resolveConfigSnapshotHash(snapshot);
    const config = snapshot?.config;

    return res.json({
      ok: true,
      source: 'gateway',
      configValid: snapshot?.valid !== false,
      hash: hash || undefined,
      config: config || null,
      raw: snapshot?.raw || null
    });
  } catch (err) {
    // Fallback: read from file directly
    try {
      const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8');
      const config = JSON.parse(raw);

      return res.json({
        ok: true,
        source: 'file',
        gatewayAvailable: false,
        error: normalizeErrorMessage(err),
        config
      });
    } catch (fileErr) {
      return res.status(500).json({
        ok: false,
        error: normalizeErrorMessage(fileErr)
      });
    }
  }
});

/**
 * POST /api/config-hot-reload
 * Apply config patch via Gateway (hot reload)
 */
router.post('/', async (req, res) => {
  try {
    const { patch, baseHash, note } = req.body || {};

    if (!patch) {
      return res.status(400).json({ ok: false, error: "Missing patch data" });
    }

    // Get current snapshot if baseHash not provided
    let hash = baseHash;
    if (!hash) {
      const snapshot = await getConfigSnapshot();
      hash = resolveConfigSnapshotHash(snapshot) || undefined;
    }

    // Apply patch via Gateway
    const result = await callOpenclawGateway(
      "config.patch",
      {
        raw: typeof patch === 'string' ? patch : JSON.stringify(patch),
        baseHash: hash,
        note: note || 'Dashboard config update',
      },
      GATEWAY_CALL_TIMEOUT_MS,
    );

    // Clear cache
    clearConfigCache();

    return res.json({
      ok: true,
      applied: true,
      result
    });
  } catch (err) {
    const error = normalizeErrorMessage(err);
    return res.status(500).json({ ok: false, error });
  }
});

/**
 * POST /api/config-hot-reload/reload
 * Force Gateway to reload config from file
 */
router.post('/reload', async (req, res) => {
  try {
    // Call config.reload to force Gateway to reload from file
    const result = await callOpenclawGateway(
      "config.reload",
      {},
      GATEWAY_CALL_TIMEOUT_MS,
    );

    clearConfigCache();

    return res.json({
      ok: true,
      reloaded: true,
      result
    });
  } catch (err) {
    const error = normalizeErrorMessage(err);
    return res.status(500).json({ ok: false, error });
  }
});

/**
 * GET /api/config-hot-reload/status
 * Check Gateway availability for hot reload
 */
router.get('/status', async (req, res) => {
  try {
    const snapshot = await getConfigSnapshot();
    const hash = resolveConfigSnapshotHash(snapshot);

    return res.json({
      ok: true,
      gatewayAvailable: true,
      configValid: snapshot?.valid !== false,
      hash: hash || undefined,
      hasConfig: !!snapshot?.config
    });
  } catch (err) {
    return res.json({
      ok: false,
      gatewayAvailable: false,
      error: normalizeErrorMessage(err)
    });
  }
});

export default router;