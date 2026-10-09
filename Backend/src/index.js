import { httpServerHandler } from 'cloudflare:node';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.js';
import placesRoutes from './routes/places.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import tripsRoutes from './routes/trips.routes.js';
import itineraryRoutes from './routes/itinerary.routes.js';
import itineraryAiRoutes from './routes/itinerary-ai.routes.js';
import usersRoutes from './routes/users.routes.js';
import searchRoutes from './routes/search.routes.js';
import { snapshotService } from './services/snapshot.service.js';

const app = express();

// FIX: Allow both configured FRONTEND_URL and any localhost port (5173-5179) for local dev.
// This handles Vite incrementing the port when 5173 is already taken.
app.use((req, res, next) => {
  const allowedOrigin = req.cloudflare?.env?.FRONTEND_URL || 'http://localhost:5173';
  const requestOrigin = req.headers.origin || '';

  // In local dev, allow any localhost:5173-5180 Vite port
  const isLocalDev = /^http:\/\/localhost:(5173|5174|5175|5176|5177|5178|5179|5180)$/.test(requestOrigin);
  const origin = isLocalDev ? requestOrigin : allowedOrigin;

  cors({ origin, credentials: true })(req, res, next);
});

app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRoutes);
app.use('/places', placesRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use('/trips', tripsRoutes);
app.use('/itinerary', itineraryRoutes);
app.use('/ai', itineraryAiRoutes);
app.use('/users', usersRoutes);
app.use('/search', searchRoutes);

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

// Check the latest sync job status
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