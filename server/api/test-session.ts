import { Router } from "express";
import { testAgentSession } from "../lib/agent-test.js";

const router = Router();

// POST /api/test-session
router.post("/", async (req, res) => {
  try {
    const sessionKey = typeof req.body?.sessionKey === "string" ? req.body.sessionKey.trim() : "";
    const agentId = typeof req.body?.agentId === "string" ? req.body.agentId.trim() : "";

    if (!sessionKey || !agentId) {
      return res.status(400).json({ status: "error", error: "Missing sessionKey or agentId" });
    }

    const result = await testAgentSession(agentId, sessionKey);
    return res.json({
      status: result.ok ? "ok" : "error",
      sessionKey,
      elapsed: result.elapsed,
      reply: result.reply,
      error: result.error,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: "error",
      error: String(err?.message || "Unknown error"),
    });
  }
});

export default router;
