/**
 * Central logging. Console output in development only; in release builds the
 * messages go to an optional hook (e.g. a crash reporter) and are otherwise dropped.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogHook = (level: LogLevel, args: unknown[]) => void;

let releaseHook: LogHook | null = null;

/** Register a sink for release builds (crash reporting, remote logging...). */
export function setLogHook(hook: LogHook | null): void {
  releaseHook = hook;
}

function emit(level: LogLevel, args: unknown[]): void {
  if (__DEV__) {
    console[level](...args);
    return;
  }
  if (level === 'warn' || level === 'error') {
    try {
      releaseHook?.(level, args);
    } catch {
      // Logging must never throw.
    }
  }
}

export const logger = {
  debug: (...args: unknown[]) => emit('debug', args),
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
};

let handlersInstalled = false;

/** Route unhandled JS errors and promise rejections through the logger. Idempotent. */
export function installGlobalErrorHandlers(): void {
  if (handlersInstalled) return;
  handlersInstalled = true;

  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    logger.error(isFatal ? 'Fatal JS error' : 'Unhandled JS error', error);
    previous?.(error, isFatal);
  });

  // Web: surface unhandled promise rejections (native rejections are logged by React Native in dev).
  const g = globalThis as {
    addEventListener?: (type: string, cb: (e: { reason?: unknown }) => void) => void;
  };
  if (typeof g.addEventListener === 'function') {
    g.addEventListener('unhandledrejection', (e) => {
      logger.error('Unhandled promise rejection', e.reason);
    });
  }
}
