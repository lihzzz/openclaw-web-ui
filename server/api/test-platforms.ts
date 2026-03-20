import { Router } from 'express';

const router = Router();

router.post('/', async (req, res) => {
  // Simplified test
  const results: any[] = [];
  res.json({ results });
});

export default router;