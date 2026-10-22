import pino from 'pino';

export function createLogger(level = 'info') {
  return pino({
    level,
    base: { service: 'baseerah-api' },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      censor: '[redacted]',
    },
  });
}