import { Router } from "express";
import { testAgentSession } from "../lib/agent-test.js";
import { findLatestPlatformSessionKey, getConfiguredAgentPlatforms } from "../lib/agent-platforms.js";

const router = Router();

router.post("/", async (_req, res) => {
  try {
    const targets = getConfiguredAgentPlatforms();
    const results = await Promise.all(
      targets.map(async ({ agentId, platform }) => {
        const sessionKey = findLatestPlatformSessionKey(agentId, platform);
        if (!sessionKey) {
          return {
            agentId,
            platform,
            ok: false,
            elapsed: 0,
            error: `No session found for ${platform}`,
          };
        }

        const outcome = await testAgentSession(agentId, sessionKey);
        return {
          agentId,
          platform,
          ok: outcome.ok,
          elapsed: outcome.elapsed,
          reply: outcome.reply,
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
