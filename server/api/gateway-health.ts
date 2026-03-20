import { Router } from 'express';
import http from 'http';

const router = Router();

router.get('/', async (req, res) => {
  const host = process.env.VITE_GATEWAY_HOST || '127.0.0.1';
  const port = parseInt(process.env.VITE_GATEWAY_PORT || '18789');

  try {
    const result = await new Promise<{ ok: boolean; openclawVersion?: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Gateway health check timeout'));
      }, 5000);

      const request = http.request({
        hostname: host,
        port: port,
        path: '/health',
        method: 'GET',
        timeout: 5000
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          clearTimeout(timeout);
          try {
            const json = JSON.parse(data);
            resolve({ ok: json.ok === true, openclawVersion: json.version });
          } catch {
            resolve({ ok: response.statusCode === 200 });
          }
        });
      });

      request.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      request.on('timeout', () => {
        clearTimeout(timeout);
        request.destroy();
        reject(new Error('Gateway health check timeout'));
      });

      request.end();
    });

    res.json(result);
  } catch (err: any) {
    res.json({ ok: false, error: err.message });
  }
});

export default router;