/**
 * Logging Utility for PRISM Frontend
 * 
 * Provides centralized logging with environment-based log levels.
 * 
 * Usage:
 *   import { log } from '@/utils/log';
 *   
 *   log.debug('Debug message', data);
 *   log.info('Info message');
 *   log.warn('Warning message');
 *   log.error('Error message', error);
 * 
 * Log Levels (by VITE_LOG_LEVEL env variable):
 *   - 'debug': Show all logs (development)
 *   - 'info': Show info, warn, error (staging)
 *   - 'warn': Show warn, error only (production)
 *   - 'error': Show error only (production)
 *   - 'silent': Disable all logs (production)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

// Get log level from environment variable, default to 'info' in production, 'debug' in development
const getLogLevel = (): LogLevel => {
  const envLevel = import.meta.env.VITE_LOG_LEVEL;
  if (envLevel && LOG_LEVELS.hasOwnProperty(envLevel)) {
    return envLevel as LogLevel;
  }
  // Default based on NODE_ENV
  return import.meta.env.PROD ? 'error' : 'debug';
};

const currentLevel = getLogLevel();
const currentLevelNum = LOG_LEVELS[currentLevel];

// Base logger function
const logMessage = (
  level: LogLevel,
  levelNum: number,
  message: string,
  ...args: unknown[]
) => {
  // Skip if current level is higher than message level
  if (levelNum < currentLevelNum) {
    return;
  }

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  // Use appropriate console method based on level
  switch (level) {
    case 'debug':
      console.debug(prefix, message, ...args);
      break;
    case 'info':
      console.info(prefix, message, ...args);
      break;
    case 'warn':
      console.warn(prefix, message, ...args);
      break;
    case 'error':
      console.error(prefix, message, ...args);
      break;
  }
};

export const log = {
  /**
   * Debug level logging - detailed information for debugging
   */
  debug: (message: string, ...args: unknown[]) => {
    logMessage('debug', LOG_LEVELS.debug, message, ...args);
  },

  /**
   * Info level logging - general informational messages
   */
  info: (message: string, ...args: unknown[]) => {
    logMessage('info', LOG_LEVELS.info, message, ...args);
  },

  /**
   * Warning level logging - potential issues or deprecated features
   */
  warn: (message: string, ...args: unknown[]) => {
    logMessage('warn', LOG_LEVELS.warn, message, ...args);
  },

  /**
   * Error level logging - errors and exceptions
   */
  error: (message: string, ...args: unknown[]) => {
    logMessage('error', LOG_LEVELS.error, message, ...args);
  },

  /**
   * Get current log level
   */
  getLevel: (): LogLevel => currentLevel,
};

/**
 * Error handler utility for async operations
 * Wraps try-catch blocks with consistent error logging and user feedback
 */
export const handleError = async <T>(
  operation: () => Promise<T>,
  errorMessage: string,
  options?: {
    showToast?: boolean;
    logLevel?: LogLevel;
    onError?: (error: unknown) => void;
  }
): Promise<T | undefined> => {
  try {
    return await operation();
  } catch (error) {
    const logLevel = options?.logLevel || 'error';
    
    // Log the error
    if (logLevel === 'error') {
      log.error(errorMessage, error);
    } else {
      logMessage(logLevel, LOG_LEVELS[logLevel], errorMessage, error);
    }

    // Call custom error handler if provided
    if (options?.onError) {
      options.onError(error);
    }

    // Show toast notification if enabled
    if (options?.showToast !== false) {
      // Dynamic import to avoid circular dependencies
      import('antd').then(({ message }) => {
        message.error(errorMessage);
      });
    }

    return undefined;
  }
};

export default log;
