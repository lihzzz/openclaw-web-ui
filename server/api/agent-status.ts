import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { OPENCLAW_HOME } from '../lib/openclaw-paths.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const agentsDir = path.join(OPENCLAW_HOME, "agents");
    let agentIds: string[];
    try {
      agentIds = fs.readdirSync(agentsDir).filter(f => fs.statSync(path.join(agentsDir, f)).isDirectory());
    } catch { agentIds = []; }

    const statuses: { agentId: string; state: string }[] = [];

    for (const agentId of agentIds) {
      const agentDir = path.join(agentsDir, agentId);
      const pidFile = path.join(agentDir, "agent.pid");
      const lockFile = path.join(agentDir, "agent.lock");

      let state = "offline";

      // Check if agent is running (simplified check)
      try {
        if (fs.existsSync(pidFile)) {
          const pid = parseInt(fs.readFileSync(pidFile, "utf-8").trim());
          if (pid > 0) {
            // Try to check if process is running
            try {
              process.kill(pid, 0);
              state = "online";
            } catch {
              // Process not running
            }
          }
        }
      } catch {}

      // Check for recent activity
      const sessionsDir = path.join(agentDir, "sessions");
      try {
        const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith(".jsonl"));
        if (files.length > 0) {
          const latestFile = files.map(f => ({
            name: f,
            mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs
          })).sort((a, b) => b.mtime - a.mtime)[0];

          if (latestFile && Date.now() - latestFile.mtime < 60000) {
            state = "working";
          } else if (state === "offline" && latestFile && Date.now() - latestFile.mtime < 300000) {
            state = "idle";
          }
        }
      } catch {}

      statuses.push({ agentId: agentId, state });
    }

    res.json({ statuses });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;