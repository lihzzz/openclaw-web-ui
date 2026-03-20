import { Router } from 'express';

const router = Router();

router.post('/', async (req, res) => {
  // Simplified test - in real implementation this would test each agent
  const results = [
    { agentId: 'main', ok: true, elapsed: 100 }
  ];
  res.json({ results });
});

export default router;