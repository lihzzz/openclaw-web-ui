import { Router } from 'express';
import {
  readSkillFile,
  writeSkillFile,
  createSkill,
  deleteSkill,
  listSkillFiles,
  createSkillFile,
  deleteSkillFile,
  getOpenclawSkillByLocation,
  listOpenclawSkills
} from '../lib/openclaw-skills.js';
import { OPENCLAW_SKILLS_DIR } from '../lib/openclaw-paths.js';
import { callOpenclawGateway } from '../lib/openclaw-cli.js';
import { clearConfigCache } from '../lib/config-cache.js';
import path from 'path';

const router = Router();

const GATEWAY_CALL_TIMEOUT_MS = 15000;

/**
 * GET /api/skill-files
 * Get skill files list
 */
router.get('/', (req, res) => {
  const { skillDir } = req.query;

  if (!skillDir) {
    return res.status(400).json({ error: 'Missing skillDir parameter' });
  }

  try {
    const files = listSkillFiles(String(skillDir));
    res.json({ files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/skill-files/read
 * Read a specific file
 */
router.get('/read', (req, res) => {
  const { filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ error: 'Missing filePath parameter' });
  }

  try {
    const result = readSkillFile(String(filePath));
    if (!result.exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.json({ content: result.content, exists: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/skill-files/write
 * Write to a file (create or update)
 */
router.post('/write', async (req, res) => {
  const { filePath, content } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: 'Missing filePath parameter' });
  }

  try {
    const result = writeSkillFile(String(filePath), String(content || ''));
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // Try to trigger hot reload via Gateway
    try {
      await callOpenclawGateway('config.reload', {}, GATEWAY_CALL_TIMEOUT_MS);
      clearConfigCache();
    } catch {
      // Gateway might not be running, that's okay
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/skill-files/create-skill
 * Create a new skill
 */
router.post('/create-skill', async (req, res) => {
  const { skillId, name, description, emoji } = req.body;

  if (!skillId) {
    return res.status(400).json({ error: 'Missing skillId parameter' });
  }

  try {
    const result = createSkill(
      String(skillId),
      String(name || skillId),
      String(description || ''),
      String(emoji || '🔧')
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Try to trigger hot reload via Gateway
    try {
      await callOpenclawGateway('config.reload', {}, GATEWAY_CALL_TIMEOUT_MS);
      clearConfigCache();
    } catch {
      // Gateway might not be running
    }

    res.json({ success: true, skill: result.skill });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/skill-files/delete-skill
 * Delete a skill
 */
router.delete('/delete-skill', async (req, res) => {
  const { source, skillId } = req.body;

  if (!source || !skillId) {
    return res.status(400).json({ error: 'Missing source or skillId parameter' });
  }

  try {
    const result = deleteSkill(String(source), String(skillId));

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Try to trigger hot reload via Gateway
    try {
      await callOpenclawGateway('config.reload', {}, GATEWAY_CALL_TIMEOUT_MS);
      clearConfigCache();
    } catch {
      // Gateway might not be running
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/skill-files/create-file
 * Create a new file in a skill directory
 */
router.post('/create-file', async (req, res) => {
  const { skillDir, fileName, content } = req.body;

  if (!skillDir || !fileName) {
    return res.status(400).json({ error: 'Missing skillDir or fileName parameter' });
  }

  try {
    const result = createSkillFile(String(skillDir), String(fileName), String(content || ''));

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Try to trigger hot reload via Gateway
    try {
      await callOpenclawGateway('config.reload', {}, GATEWAY_CALL_TIMEOUT_MS);
      clearConfigCache();
    } catch {
      // Gateway might not be running
    }

    res.json({ success: true, path: result.path });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/skill-files/delete-file
 * Delete a file
 */
router.delete('/delete-file', async (req, res) => {
  const { filePath } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: 'Missing filePath parameter' });
  }

  try {
    const result = deleteSkillFile(String(filePath));

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Try to trigger hot reload via Gateway
    try {
      await callOpenclawGateway('config.reload', {}, GATEWAY_CALL_TIMEOUT_MS);
      clearConfigCache();
    } catch {
      // Gateway might not be running
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/skill-files/reload
 * Force reload skills via Gateway
 */
router.post('/reload', async (req, res) => {
  try {
    await callOpenclawGateway('config.reload', {}, GATEWAY_CALL_TIMEOUT_MS);
    clearConfigCache();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;