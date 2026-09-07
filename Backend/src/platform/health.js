/**
 * Health endpoint — PLAT-01.
 *
 * Doc B §2: "Every environment records its build SHA, config version and feature-flag state
 * on a health endpoint, so 'what is actually running' is never guesswork."
 *
 * Two endpoints, because they answer different questions:
 *   GET /health       liveness — is the process up? Cheap, no dependencies. Platform probes.
 *   GET /health/ready readiness — can it serve traffic? Checks dependencies.
 *
 * A liveness probe that checks the database restarts a healthy server during a database
 * blip, turning a degradation into an outage.
 *
 * Deliberately exposes NO credentials, connection strings or origins — a health endpoint is
 * usually public.
 */

import { Router } from 'express';
import { config } from './config.js';

const startedAt = Date.now();

export const healthRouter = Router();

healthRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    env: config.env,
    build: config.build,
    flags: config.flags,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    time: new Date().toISOString(),
  });
});

healthRouter.get('/health/ready', async (req, res) => {
  const checks = {
    // Configuration presence only — not a live query. A real probe lands with the first
    // module that owns a table; see docs/MODULES.md.
    supabase: config.supabase.url && config.supabase.anonKey ? 'configured' : 'not-configured',
  };

  const ready = !Object.values(checks).includes('error');
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not-ready', checks });
});
