import { Router } from 'express';

const router = Router();

router.post('/', async (req, res) => {
  const results: any[] = [];
  res.json({ results });
});

export default router;