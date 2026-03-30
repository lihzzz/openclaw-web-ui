import { Router } from 'express';
import { getAgentSessionStats, aggregateWeeklyMonthly, statsCache, type DayStat } from '../lib/session-parser.js';

const router = Router();

router.get('/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;

    // 检查缓存
    const cacheKey = `stats:${agentId}`;
    const cached = statsCache.get<{ daily: DayStat[]; weekly: DayStat[]; monthly: DayStat[] }>(cacheKey);

    if (cached) {
      return res.json({
        agentId,
        ...cached
      });
    }

    // 异步获取统计
    const dailyStats = await getAgentSessionStats(agentId);

    // 清理内部字段并计算平均响应时间
    const daily: DayStat[] = dailyStats.map(({ responseTimes, ...rest }) => rest);

    const { weekly, monthly } = aggregateWeeklyMonthly(daily);

    const result = { daily, weekly, monthly };

    // 写入缓存
    statsCache.set(cacheKey, result);

    res.json({
      agentId,
      ...result
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
