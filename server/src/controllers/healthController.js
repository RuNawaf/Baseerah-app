/** Health plus the public crawl limits, so the client can tell people what a scan will do. */
export function createHealthController(config) {
  return function health(req, res) {
    res.json({
      status: 'ok',
      service: 'baseerah-api',
      time: new Date().toISOString(),
      limits: { ...config.scan },
    });
  };
}