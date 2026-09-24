import { httpServerHandler } from 'cloudflare:node';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.js';

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

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = 8080;
app.listen(PORT);

export default httpServerHandler({ port: PORT });