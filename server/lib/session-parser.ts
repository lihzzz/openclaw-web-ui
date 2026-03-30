/**
 * 会话解析公共层
 * 提供异步文件扫描、统计计算和缓存功能
 */

import fs from 'fs/promises';
import path from 'path';
import { OPENCLAW_HOME } from './openclaw-paths.js';

// ===== 类型定义 =====

export interface DayStat {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  messageCount: number;
  avgResponseMs: number;
}

export interface InternalDayStat extends DayStat {
  responseTimes: number[];
}

export interface SessionStats {
  daily: DayStat[];
  weekly: DayStat[];
  monthly: DayStat[];
}

export interface AgentSessionStatus {
  lastActive: number | null;
  totalTokens: number;
  contextTokens: number;
  sessionCount: number;
  todayAvgResponseMs: number;
  messageCount: number;
  weeklyResponseMs: number[];
  weeklyTokens: number[];
}

// ===== 缓存机制 =====

interface CacheEntry<T> {
  data: T;
  ts: number;
  key: string;
}

class StatsCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs = 30_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this.defaultTtlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.cache.set(key, {
      data,
      ts: Date.now(),
      key
    });
    // 延迟清理过期缓存
    if (ttlMs) {
      setTimeout(() => this.cache.delete(key), ttlMs);
    }
  }

  invalidate(pattern?: RegExp): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

// 全局缓存实例
export const statsCache = new StatsCache(30_000);

// ===== 异步文件扫描 =====

/**
 * 异步读取会话目录中的文件列表
 */
export async function readSessionFiles(agentId: string): Promise<string[]> {
  const sessionsDir = path.join(OPENCLAW_HOME, `agents/${agentId}/sessions`);
  try {
    const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && e.name.endsWith('.jsonl') && !e.name.includes('.deleted.'))
      .map(e => path.join(sessionsDir, e.name));
  } catch {
    return [];
  }
}

/**
 * 异步读取会话文件内容
 */
export async function readSessionFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

// ===== 消息解析 =====

interface ParsedMessage {
  role: string;
  ts: string;
  stopReason?: string;
  usage?: {
    input?: number;
    output?: number;
    totalTokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
}

interface SessionEntry {
  type?: string;
  timestamp?: string;
  sessionKey?: string;
  message?: ParsedMessage;
}

/**
 * 解析会话文件内容
 */
export function parseSessionContent(content: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  const lines = content.trim().split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    let entry: SessionEntry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (entry.type !== 'message' || !entry.message || !entry.timestamp) continue;

    const msg = entry.message;
    messages.push({
      role: msg.role,
      ts: entry.timestamp,
      stopReason: msg.stopReason,
      usage: msg.usage
    });
  }

  return messages;
}

/**
 * 计算 Token 使用量（支持多种字段名）
 */
export function calculateTokenUsage(usage: ParsedMessage['usage']): { input: number; output: number; total: number } {
  if (!usage) return { input: 0, output: 0, total: 0 };

  const input = usage.input ?? usage.prompt_tokens ?? usage.inputTokens ?? 0;
  const output = usage.output ?? usage.completion_tokens ?? usage.outputTokens ?? 0;
  const total = usage.totalTokens ?? input + output;

  return { input, output, total };
}

// ===== 统计计算 =====

/**
 * 聚合日统计数据
 */
export function aggregateDailyStats(messages: ParsedMessage[]): InternalDayStat[] {
  const dayMap: Record<string, InternalDayStat> = {};

  for (const msg of messages) {
    const date = msg.ts.slice(0, 10);

    if (msg.role === 'assistant' && msg.usage) {
      if (!dayMap[date]) {
        dayMap[date] = {
          date,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          messageCount: 0,
          avgResponseMs: 0,
          responseTimes: []
        };
      }

      const usage = calculateTokenUsage(msg.usage);
      dayMap[date].inputTokens += usage.input;
      dayMap[date].outputTokens += usage.output;
      dayMap[date].totalTokens += usage.total;
      dayMap[date].messageCount += 1;
    }
  }

  // 计算响应时间
  let lastUserTs: string | null = null;
  for (const msg of messages) {
    if (msg.role === 'user') {
      lastUserTs = msg.ts;
    } else if (msg.role === 'assistant' && msg.stopReason === 'stop' && lastUserTs) {
      const diffMs = new Date(msg.ts).getTime() - new Date(lastUserTs).getTime();
      if (diffMs > 0 && diffMs < 600_000) { // 上限 10 分钟
        const date = lastUserTs.slice(0, 10);
        if (!dayMap[date]) {
          dayMap[date] = {
            date,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            messageCount: 0,
            avgResponseMs: 0,
            responseTimes: []
          };
        }
        dayMap[date].responseTimes.push(diffMs);
      }
      lastUserTs = null;
    }
  }

  return Object.values(dayMap);
}

/**
 * 聚合周/月统计数据
 */
export function aggregateWeeklyMonthly(daily: DayStat[]): { weekly: DayStat[]; monthly: DayStat[] } {
  const weekMap: Record<string, DayStat> = {};
  const monthMap: Record<string, DayStat> = {};

  for (const d of daily) {
    // 计算周起始（周一）
    const dt = new Date(d.date + 'T00:00:00Z');
    const day = dt.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(dt.getTime() + mondayOffset * 86_400_000);
    const weekKey = monday.toISOString().slice(0, 10);

    if (!weekMap[weekKey]) {
      weekMap[weekKey] = {
        date: weekKey,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        messageCount: 0,
        avgResponseMs: 0
      };
    }
    weekMap[weekKey].inputTokens += d.inputTokens;
    weekMap[weekKey].outputTokens += d.outputTokens;
    weekMap[weekKey].totalTokens += d.totalTokens;
    weekMap[weekKey].messageCount += d.messageCount;

    // 计算月
    const monthKey = d.date.slice(0, 7);
    if (!monthMap[monthKey]) {
      monthMap[monthKey] = {
        date: monthKey,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        messageCount: 0,
        avgResponseMs: 0
      };
    }
    monthMap[monthKey].inputTokens += d.inputTokens;
    monthMap[monthKey].outputTokens += d.outputTokens;
    monthMap[monthKey].totalTokens += d.totalTokens;
    monthMap[monthKey].messageCount += d.messageCount;
  }

  return {
    weekly: Object.values(weekMap).sort((a, b) => a.date.localeCompare(b.date)),
    monthly: Object.values(monthMap).sort((a, b) => a.date.localeCompare(b.date))
  };
}

// ===== 公共 API =====

/**
 * 获取 Agent 的会话统计（异步）
 */
export async function getAgentSessionStats(agentId: string): Promise<InternalDayStat[]> {
  const cacheKey = `agent-sessions:${agentId}`;
  const cached = statsCache.get<InternalDayStat[]>(cacheKey);
  if (cached) return cached;

  const filePaths = await readSessionFiles(agentId);
  if (filePaths.length === 0) return [];

  // 并行读取所有文件
  const contents = await Promise.all(filePaths.map(readSessionFile));

  const dayMap: Record<string, InternalDayStat> = {};

  for (const content of contents) {
    if (!content) continue;
    const messages = parseSessionContent(content);
    const dailyStats = aggregateDailyStats(messages);

    for (const stat of dailyStats) {
      if (!dayMap[stat.date]) {
        dayMap[stat.date] = {
          date: stat.date,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          messageCount: 0,
          avgResponseMs: 0,
          responseTimes: []
        };
      }
      const d = dayMap[stat.date];
      d.inputTokens += stat.inputTokens;
      d.outputTokens += stat.outputTokens;
      d.totalTokens += stat.totalTokens;
      d.messageCount += stat.messageCount;
      d.responseTimes.push(...stat.responseTimes);
    }
  }

  // 计算平均响应时间并清理
  const result: InternalDayStat[] = Object.values(dayMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(day => {
      if (day.responseTimes.length > 0) {
        day.avgResponseMs = Math.round(day.responseTimes.reduce((a, b) => a + b, 0) / day.responseTimes.length);
      }
      return day;
    });

  statsCache.set(cacheKey, result);
  return result;
}

/**
 * 获取 Agent 实时状态（异步）
 */
export async function getAgentStatus(agentId: string): Promise<AgentSessionStatus> {
  const cacheKey = `agent-status:${agentId}`;
  const cached = statsCache.get<AgentSessionStatus>(cacheKey);
  if (cached) return cached;

  const result: AgentSessionStatus = {
    lastActive: null,
    totalTokens: 0,
    contextTokens: 0,
    sessionCount: 0,
    todayAvgResponseMs: 0,
    messageCount: 0,
    weeklyResponseMs: [],
    weeklyTokens: []
  };

  const sessionsDir = path.join(OPENCLAW_HOME, `agents/${agentId}/sessions`);
  const today = new Date().toISOString().slice(0, 10);

  // 生成最近 7 天日期
  const weekDates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    weekDates.push(d.toISOString().slice(0, 10));
  }

  const dailyResponseTimes: Record<string, number[]> = {};
  const dailyTokens: Record<string, number> = {};
  for (const d of weekDates) {
    dailyResponseTimes[d] = [];
    dailyTokens[d] = 0;
  }

  // 只读取最近 7 天的文件
  const cutoff = Date.now() - 7 * 86_400_000;
  let filePaths: string[] = [];
  try {
    const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
    const allFiles = entries
      .filter(e => e.isFile() && e.name.endsWith('.jsonl') && !e.name.includes('.deleted.'))
      .map(e => ({
        path: path.join(sessionsDir, e.name),
        name: e.name
      }));

    // 获取文件修改时间并过滤
    const filesWithStats = await Promise.all(
      allFiles.map(async f => {
        try {
          const stat = await fs.stat(f.path);
          return { ...f, mtimeMs: stat.mtimeMs };
        } catch {
          return null;
        }
      })
    );

    filePaths = filesWithStats
      .filter(f => f && f.mtimeMs >= cutoff)
      .map(f => f!.path);
  } catch {
    return result;
  }

  const sessionKeys = new Set<string>();

  // 并行读取文件
  const contents = await Promise.all(filePaths.map(readSessionFile));

  for (const content of contents) {
    if (!content) continue;

    const lines = content.trim().split('\n');
    const messages: { role: string; ts: string; stopReason?: string }[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      let entry: SessionEntry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }

      if (entry.sessionKey) sessionKeys.add(entry.sessionKey);

      if (entry.type === 'message' && entry.message && entry.timestamp) {
        const msg = entry.message;
        if (msg.role === 'assistant' && msg.usage) {
          const usage = calculateTokenUsage(msg.usage);
          result.totalTokens += usage.input + usage.output;
          result.messageCount += 1;

          const msgDate = entry.timestamp.slice(0, 10);
          if (dailyTokens[msgDate] !== undefined) {
            dailyTokens[msgDate] += usage.input + usage.output;
          }
        }

        const ts = new Date(entry.timestamp).getTime();
        if (!result.lastActive || ts > result.lastActive) {
          result.lastActive = ts;
        }

        messages.push({
          role: msg.role,
          ts: entry.timestamp,
          stopReason: msg.stopReason
        });
      }
    }

    // 计算响应时间
    let lastUserTs: string | null = null;
    for (const msg of messages) {
      if (msg.role === 'user') {
        lastUserTs = msg.ts;
      } else if (msg.role === 'assistant' && msg.stopReason === 'stop' && lastUserTs) {
        const msgDate = lastUserTs.slice(0, 10);
        if (dailyResponseTimes[msgDate]) {
          const diffMs = new Date(msg.ts).getTime() - new Date(lastUserTs).getTime();
          if (diffMs > 0 && diffMs < 600_000) {
            dailyResponseTimes[msgDate].push(diffMs);
          }
        }
        lastUserTs = null;
      }
    }
  }

  result.sessionCount = sessionKeys.size || filePaths.length;

  const todayTimes = dailyResponseTimes[today] || [];
  if (todayTimes.length > 0) {
    result.todayAvgResponseMs = Math.round(todayTimes.reduce((a, b) => a + b, 0) / todayTimes.length);
  }

  result.weeklyResponseMs = weekDates.map(d => {
    const times = dailyResponseTimes[d];
    return times && times.length > 0
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : 0;
  });

  result.weeklyTokens = weekDates.map(d => dailyTokens[d] || 0);

  statsCache.set(cacheKey, result);
  return result;
}

/**
 * 异步扫描 Agent 目录列表
 */
async function scanAgentDirectories(): Promise<string[]> {
  const agentsDir = path.join(OPENCLAW_HOME, 'agents');
  try {
    const entries = await fs.readdir(agentsDir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch (err: any) {
    // 目录不存在或无法读取时返回空数组
    if (err.code === 'ENOENT') {
      console.warn('[session-parser] Agents directory not found:', agentsDir);
    } else {
      console.error('[session-parser] Error reading agents directory:', err);
    }
    return [];
  }
}

/**
 * 获取所有 Agent 的统计（异步聚合）
 */
export async function getAllAgentsStats(): Promise<SessionStats> {
  const cacheKey = 'all-agents-stats';
  const cached = statsCache.get<SessionStats>(cacheKey);
  if (cached) return cached;

  const agentIds = await scanAgentDirectories();

  if (agentIds.length === 0) {
    return { daily: [], weekly: [], monthly: [] };
  }

  // 并行获取所有 Agent 的统计
  const allAgentStats = await Promise.all(agentIds.map(id => getAgentSessionStats(id)));

  // 聚合所有日统计
  const dayMap: Record<string, InternalDayStat> = {};
  for (const agentDays of allAgentStats) {
    for (const ad of agentDays) {
      if (!dayMap[ad.date]) {
        dayMap[ad.date] = {
          date: ad.date,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          messageCount: 0,
          avgResponseMs: 0,
          responseTimes: []
        };
      }
      const d = dayMap[ad.date];
      d.inputTokens += ad.inputTokens;
      d.outputTokens += ad.outputTokens;
      d.totalTokens += ad.totalTokens;
      d.messageCount += ad.messageCount;
      d.responseTimes.push(...ad.responseTimes);
    }
  }

  const daily: DayStat[] = Object.values(dayMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ responseTimes, ...rest }) => {
      if (responseTimes.length > 0) {
        rest.avgResponseMs = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
      }
      return rest;
    });

  const { weekly, monthly } = aggregateWeeklyMonthly(daily);
  const result: SessionStats = { daily, weekly, monthly };

  statsCache.set(cacheKey, result);
  return result;
}

/**
 * 清除统计缓存（用于配置更新后）
 */
export function invalidateStatsCache(pattern?: RegExp): void {
  statsCache.invalidate(pattern);
}
