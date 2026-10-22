import { AppError } from '../errors/AppError.js';

export function createScanController(scanService) {
  return {
    async create(req, res) {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        throw new AppError('INVALID_REQUEST');
      }
      const { url } = req.body;
      if (url !== undefined && typeof url !== 'string') throw new AppError('INVALID_REQUEST');

      const scan = await scanService.startScan(url);
      res.status(202).location(`/api/scans/${scan.scanId}`).json(scan);
    },

    show(req, res) {
      res.json(scanService.getScan(req.params.scanId));
    },
  };
}