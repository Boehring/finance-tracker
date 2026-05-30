type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_LOG_LEVEL) || 'info';

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
};

const ts = (): string => new Date().toISOString();

export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (shouldLog('debug')) console.debug(`[${ts()}] [DEBUG] ${message}`, ...args);
  },
  info: (message: string, ...args: any[]) => {
    if (shouldLog('info')) console.info(`[${ts()}] [INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    if (shouldLog('warn')) console.warn(`[${ts()}] [WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    if (shouldLog('error')) console.error(`[${ts()}] [ERROR] ${message}`, ...args);
  },
};
