import { Router } from 'express';
import {
  readSkillFile,
  writeSkillFile,
  createSkill,
  deleteSkill,
  listSkillFiles,
  createSkillFile,
  deleteSkillFile
} from '../lib/openclaw-skills.js';
import { callOpenclawGateway } from '../lib/openclaw-cli.js';
import { clearConfigCache } from '../lib/config-cache.js';

const router = Router();

const GATEWAY_CALL_TIMEOUT_MS = 15000;

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sendSkillFileError(res: any, err: any) {
  const message = err instanceof Error ? err.message : String(err || 'Unknown error');
  if (message.includes('outside allowed skill directories') || message.includes('Invalid')) {
    return res.status(400).json({ error: message });
  }
  return res.status(500).json({ error: message });
}

/**
 * GET /api/skill-files
 * Get skill files list
 */
router.get('/', (req, res) => {
  const skillDir = getString(req.query.skillDir);

  if (!skillDir) {
    return res.status(400).json({ error: 'Missing skillDir parameter' });
  }

  try {
    const files = listSkillFiles(skillDir);
    res.json({ files });
  } catch (err: any) {
    sendSkillFileError(res, err);
  }
});

/**
 * GET /api/skill-files/read
 * Read a specific file
 */
router.get('/read', (req, res) => {
  const filePath = getString(req.query.filePath);

  if (!filePath) {
    return res.status(400).json({ error: 'Missing filePath parameter' });
  }

  try {
    const result = readSkillFile(filePath);
    if (!result.exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.json({ content: result.content, exists: true });
  } catch (err: any) {
    sendSkillFileError(res, err);
  }
});

/**
 * POST /api/skill-files/write
 * Write to a file (create or update)
 */
router.post('/write', async (req, res) => {
  const filePath = getString(req.body?.filePath);
  const content = typeof req.body?.content === 'string' ? req.body.content : '';

  if (!filePath) {
    return res.status(400).json({ error: 'Missing filePath parameter' });
  }

  try {
    const result = writeSkillFile(filePath, content);
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
    sendSkillFileError(res, err);
  }
});

/**
 * POST /api/skill-files/create-skill
 * Create a new skill
 */
router.post('/create-skill', async (req, res) => {
  const skillId = getString(req.body?.skillId);
  const name = getString(req.body?.name);
  const description = getString(req.body?.description);
  const emoji = getString(req.body?.emoji);

  if (!skillId) {
    return res.status(400).json({ error: 'Missing skillId parameter' });
  }

  try {
    const result = createSkill(
      skillId,
      name || skillId,
      description || '',
      emoji || '🔧'
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
    sendSkillFileError(res, err);
  }
});

/**
 * DELETE /api/skill-files/delete-skill
 * Delete a skill
 */
router.delete('/delete-skill', async (req, res) => {
  const source = getString(req.body?.source);
  const skillId = getString(req.body?.skillId);

  if (!source || !skillId) {
    return res.status(400).json({ error: 'Missing source or skillId parameter' });
  }

  try {
    const result = deleteSkill(source, skillId);

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
    sendSkillFileError(res, err);
  }
});

/**
 * POST /api/skill-files/create-file
 * Create a new file in a skill directory
 */
router.post('/create-file', async (req, res) => {
  const skillDir = getString(req.body?.skillDir);
  const fileName = getString(req.body?.fileName);
  const content = typeof req.body?.content === 'string' ? req.body.content : '';

  if (!skillDir || !fileName) {
    return res.status(400).json({ error: 'Missing skillDir or fileName parameter' });
  }

  try {
    const result = createSkillFile(skillDir, fileName, content);

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
    sendSkillFileError(res, err);
  }
});

/**
 * DELETE /api/skill-files/delete-file
 * Delete a file
 */
router.delete('/delete-file', async (req, res) => {
  const filePath = getString(req.body?.filePath);

  if (!filePath) {
    return res.status(400).json({ error: 'Missing filePath parameter' });
  }

  try {
    const result = deleteSkillFile(filePath);

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
    sendSkillFileError(res, err);
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
