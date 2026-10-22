import { Router } from 'express';
import { createScanController } from '../controllers/scanController.js';
import { AppError } from '../errors/AppError.js';

const SCAN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function scanRoutes({ scanService, scanRateLimiter }) {
  const router = Router();
  const controller = createScanController(scanService);

  router.post('/', scanRateLimiter, controller.create);
  router.get('/:scanId', (req, res, next) => {
    if (!SCAN_ID_PATTERN.test(req.params.scanId)) return next(new AppError('SCAN_NOT_FOUND'));
    return controller.show(req, res);
  });
  return router;
}