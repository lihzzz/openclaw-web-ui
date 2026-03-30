import { Router } from "express";
import { testAgentSession } from "../lib/agent-test.js";
import { findLatestDmSessionKey, getConfiguredAgentPlatforms } from "../lib/agent-platforms.js";

const router = Router();

router.post("/", async (_req, res) => {
  try {
    const targets = getConfiguredAgentPlatforms().filter(({ platform }) =>
      ["feishu", "discord", "telegram", "whatsapp", "qqbot"].includes(platform),
    );

    const results = await Promise.all(
      targets.map(async ({ agentId, platform }) => {
        const sessionKey = findLatestDmSessionKey(agentId, platform);
        if (!sessionKey) {
          return {
            agentId,
            platform,
            ok: false,
            elapsed: 0,
            error: `No DM session found for ${platform}`,
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
