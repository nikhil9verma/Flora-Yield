const { createLogger, format, transports } = require('winston');
const { combine, timestamp, colorize, printf, errors } = format;

const logFormat = printf(({ level, message, timestamp: ts, service, stack }) => {
  const svc = service ? `[${service}]` : '';
  const err = stack ? `\n${stack}` : '';
  return `${ts} ${level} ${svc} ${message}${err}`;
});

function createServiceLogger(serviceName) {
  return createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: serviceName },
    format: combine(
      errors({ stack: true }),
      timestamp({ format: 'HH:mm:ss' }),
      colorize(),
      logFormat
    ),
    transports: [new transports.Console()],
  });
}

module.exports = { createServiceLogger };
