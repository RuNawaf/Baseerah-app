import { Router } from 'express';
import { createHealthController } from '../controllers/healthController.js';

export function healthRoutes({ config }) {
  const router = Router();
  router.get('/', createHealthController(config));
  return router;
}