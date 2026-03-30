import { Router } from 'express';
import { listAgentSessions } from '../lib/sessions.js';

const router = Router();

// GET /api/sessions/:agentId
router.get('/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;
    const sessions = listAgentSessions(agentId);
    res.json({ agentId, sessions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
