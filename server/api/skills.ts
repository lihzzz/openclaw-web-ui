import { Router } from 'express';
import { listOpenclawSkills, getOpenclawSkillContent } from '../lib/openclaw-skills.js';

const router = Router();

/**
 * GET /api/skills
 * List all skills
 */
router.get('/', (req, res) => {
  try {
    const result = listOpenclawSkills();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/skills/content
 * Get skill content
 */
router.get('/content', (req, res) => {
  const { source, id } = req.query;

  if (!source || !id) {
    return res.status(400).json({ error: 'Missing source or id parameter' });
  }

  try {
    const result = getOpenclawSkillContent(String(source), String(id));
    if (!result) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;