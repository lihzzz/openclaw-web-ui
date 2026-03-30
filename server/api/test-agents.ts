import { Router } from "express";
import { listAgentIds, testAgentSession } from "../lib/agent-test.js";

const router = Router();

router.post("/", async (_req, res) => {
  try {
    const agentIds = listAgentIds();
    const results = await Promise.all(
      agentIds.map(async (agentId) => {
        const outcome = await testAgentSession(agentId);
        return {
          agentId,
          ok: outcome.ok,
          elapsed: outcome.elapsed,
          text: outcome.reply,
          error: outcome.error,
        };
      }),
    );
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || "Unknown error"), results: [] });
  }
});

export default router;
