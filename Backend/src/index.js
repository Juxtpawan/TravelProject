import { httpServerHandler } from 'cloudflare:node';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.js';
import placesRoutes from './routes/places.routes.js';
import { snapshotService } from './services/snapshot.service.js';

const app = express();

// FIX: process.env.FRONTEND_URL is not reliably populated in this setup —
// same root cause your auth.routes.js fix already worked around for
// GOOGLE_CLIENT_ID/JWT_SECRET. A static cors({ origin: process.env.X })
// ends up with origin === undefined, so the `cors` package silently omits
// Access-Control-Allow-Origin — exactly the browser error you're seeing.
// Reading it per-request from req.cloudflare.env fixes it the same way.
app.use((req, res, next) => {
  const allowedOrigin = req.cloudflare?.env?.FRONTEND_URL;
  cors({ origin: allowedOrigin, credentials: true })(req, res, next);
});

app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRoutes);
app.use('/places', placesRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

// ── Manual trigger for testing the monthly sync locally ───────────────────────
// Hit: POST http://localhost:8787/admin/sync
// In production this runs automatically via the Cloudflare cron trigger.
app.post('/admin/sync', async (req, res) => {
  const env = req.cloudflare?.env || process.env;
  res.json({ message: 'Monthly sync started in background', status: 'running' });
  // Run async so the HTTP response returns immediately
  snapshotService.runMonthlySync(env).catch(console.error);
});

// ── Check the latest sync job status ─────────────────────────────────────────
app.get('/admin/sync/status', async (req, res) => {
  try {
    const { d1Query } = await import('./db/client.js');
    const [latest] = await d1Query(
      'SELECT * FROM sync_jobs ORDER BY created_at DESC LIMIT 1'
    );
    res.json(latest || { message: 'No sync jobs found yet' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = 8080;
app.listen(PORT);

// ── Cloudflare Cron Handler ───────────────────────────────────────────────────
// Cloudflare calls this automatically on the schedule defined in wrangler.toml.
// The `scheduled` export is part of the Cloudflare Workers API.
export default {
  // Normal HTTP requests go through Express via httpServerHandler
  fetch: httpServerHandler({ port: PORT }).fetch,

  // Cron trigger: runs on the 1st of every month at 3:00 AM UTC
  async scheduled(event, env, ctx) {
    console.log('[cron] Monthly Wikivoyage snapshot sync triggered at', new Date().toISOString());
    ctx.waitUntil(snapshotService.runMonthlySync(env));
  },
};