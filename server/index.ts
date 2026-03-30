import express from 'express';
import cors from 'cors';
import { createCorsOptions, requireApiAuth } from './lib/api-security.js';

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.disable('x-powered-by');
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '1mb' }));
app.use('/api', requireApiAuth);

// API Routes
import configRouter from './api/config.js';
import statsAllRouter from './api/stats-all.js';
import statsRouter from './api/stats.js';
import agentStatusRouter from './api/agent-status.js';
import gatewayHealthRouter from './api/gateway-health.js';
import testAgentsRouter from './api/test-agents.js';
import testPlatformsRouter from './api/test-platforms.js';
import testSessionsRouter from './api/test-sessions.js';
import testDmSessionsRouter from './api/test-dm-sessions.js';
import agentModelRouter from './api/agent-model.js';
import sessionsRouter from './api/sessions.js';
import testSessionRouter from './api/test-session.js';
import statsModelsRouter from './api/stats-models.js';
import testModelRouter from './api/test-model.js';
import configHotReloadRouter from './api/config-hot-reload.js';
import skillsRouter from './api/skills.js';
import skillFilesRouter from './api/skill-files.js';
import schedulerRouter from './api/scheduler.js';

app.use('/api/config', configRouter);
app.use('/api/stats-all', statsAllRouter);
app.use('/api/stats', statsRouter);
app.use('/api/agent-status', agentStatusRouter);
app.use('/api/gateway-health', gatewayHealthRouter);
app.use('/api/test-agents', testAgentsRouter);
app.use('/api/test-platforms', testPlatformsRouter);
app.use('/api/test-sessions', testSessionsRouter);
app.use('/api/test-dm-sessions', testDmSessionsRouter);
app.use('/api/config/agent-model', agentModelRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/test-session', testSessionRouter);
app.use('/api/stats-models', statsModelsRouter);
app.use('/api/test-model', testModelRouter);
app.use('/api/config-hot-reload', configHotReloadRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/skill-files', skillFilesRouter);
app.use('/api/scheduler', schedulerRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'api-server-running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
