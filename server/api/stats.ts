import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { OPENCLAW_HOME } from '../lib/openclaw-paths.js';

const router = Router();

interface DayStat {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  messageCount: number;
  avgResponseMs: number;
}

interface InternalDayStat extends DayStat {
  responseTimes: number[];
}

function parseSessions(agentId: string): Omit<DayStat, 'responseTimes'>[] {
  const sessionsDir = path.join(OPENCLAW_HOME, `agents/${agentId}/sessions`);
  const dayMap: Record<string, InternalDayStat> = {};

  let files: string[];
  try {
    files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl') && !f.includes('.deleted.'));
  } catch {
    return [];
  }

  for (const file of files) {
    const filePath = path.join(sessionsDir, file);
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch { continue; }

    const lines = content.trim().split('\n');
    const messages: { role: string; ts: string; stopReason?: string }[] = [];

    for (const line of lines) {
      let entry: any;
      try { entry = JSON.parse(line); } catch { continue; }

      if (entry.type !== 'message') continue;
      const msg = entry.message;
      if (!msg || !entry.timestamp) continue;

      const ts = entry.timestamp;
      const date = ts.slice(0, 10);

      messages.push({ role: msg.role, ts, stopReason: msg.stopReason });

      if (msg.role === 'assistant' && msg.usage) {
        if (!dayMap[date]) {
          dayMap[date] = {
            date, inputTokens: 0, outputTokens: 0, totalTokens: 0,
            messageCount: 0, avgResponseMs: 0, responseTimes: []
          };
        }
        const day = dayMap[date];
        // Support multiple token field names: input/output, prompt_tokens/completion_tokens, inputTokens/outputTokens
        const input = msg.usage.input || msg.usage.prompt_tokens || msg.usage.inputTokens || 0;
        const output = msg.usage.output || msg.usage.completion_tokens || msg.usage.outputTokens || 0;
        day.inputTokens += input;
        day.outputTokens += output;
        day.totalTokens += (msg.usage.totalTokens || input + output);
        day.messageCount += 1;
      }
    }

    // Calculate response times: user msg -> next assistant msg with stopReason=stop
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role !== 'user') continue;
      for (let j = i + 1; j < messages.length; j++) {
        if (messages[j].role === 'assistant' && messages[j].stopReason === 'stop') {
          const userTs = new Date(messages[i].ts).getTime();
          const assistTs = new Date(messages[j].ts).getTime();
          const diffMs = assistTs - userTs;
          if (diffMs > 0 && diffMs < 600000) { // cap at 10 min
            const date = messages[i].ts.slice(0, 10);
            if (!dayMap[date]) {
              dayMap[date] = {
                date, inputTokens: 0, outputTokens: 0, totalTokens: 0,
                messageCount: 0, avgResponseMs: 0, responseTimes: []
              };
            }
            dayMap[date].responseTimes.push(diffMs);
          }
          break;
        }
      }
    }
  }

  // Compute avg response time and clean up
  const result = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
  for (const day of result) {
    if (day.responseTimes.length > 0) {
      day.avgResponseMs = Math.round(day.responseTimes.reduce((a, b) => a + b, 0) / day.responseTimes.length);
    }
  }

  return result.map(({ responseTimes, ...rest }) => rest);
}

function aggregateToWeeklyMonthly(daily: DayStat[]) {
  const weekMap: Record<string, DayStat> = {};
  const monthMap: Record<string, DayStat> = {};

  for (const d of daily) {
    const dt = new Date(d.date + 'T00:00:00Z');
    const day = dt.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(dt.getTime() + mondayOffset * 86400000);
    const weekKey = monday.toISOString().slice(0, 10);

    if (!weekMap[weekKey]) {
      weekMap[weekKey] = { date: weekKey, inputTokens: 0, outputTokens: 0, totalTokens: 0, messageCount: 0, avgResponseMs: 0 };
    }
    weekMap[weekKey].inputTokens += d.inputTokens;
    weekMap[weekKey].outputTokens += d.outputTokens;
    weekMap[weekKey].totalTokens += d.totalTokens;
    weekMap[weekKey].messageCount += d.messageCount;

    const monthKey = d.date.slice(0, 7);
    if (!monthMap[monthKey]) {
      monthMap[monthKey] = { date: monthKey, inputTokens: 0, outputTokens: 0, totalTokens: 0, messageCount: 0, avgResponseMs: 0 };
    }
    monthMap[monthKey].inputTokens += d.inputTokens;
    monthMap[monthKey].outputTokens += d.outputTokens;
    monthMap[monthKey].totalTokens += d.totalTokens;
    monthMap[monthKey].messageCount += d.messageCount;
  }

  return {
    weekly: Object.values(weekMap).sort((a, b) => a.date.localeCompare(b.date)),
    monthly: Object.values(monthMap).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

router.get('/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;
    const daily = parseSessions(agentId);

    const { weekly, monthly } = aggregateToWeeklyMonthly(daily);

    res.json({
      agentId,
      daily,
      weekly,
      monthly,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;