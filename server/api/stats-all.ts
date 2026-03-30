import { Router } from 'express';
import { getAllAgentsStats, type SessionStats } from '../lib/session-parser.js';

const router = Router();
const CACHE_TTL_MS = 30_000;

// 内存缓存（作为 session-parser 缓存的补充）
let statsMemoryCache: { data: SessionStats; ts: number } | null = null;

router.get('/', async (req, res) => {
  // 内存缓存检查
  if (statsMemoryCache && Date.now() - statsMemoryCache.ts < CACHE_TTL_MS) {
    return res.json(statsMemoryCache.data);
  }

  try {
    const stats = await getAllAgentsStats();

    // 更新内存缓存
    statsMemoryCache = { data: stats, ts: Date.now() };

    res.json(stats);
  } catch (err: any) {
    console.error('[stats-all] Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error', stack: err.stack });
  }
});

export default router;
