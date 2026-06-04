/**
 * Tiny structured logger. Stays dependency-free on purpose — swap for pino/winston
 * if you outgrow it. Never logs secrets: callers are responsible for the payload.
 */
import { isProd } from '../config';

type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, msg: string, meta?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta ?? {}),
  };
  const line = isProd ? JSON.stringify(entry) : prettyLine(level, msg, meta);
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : console.log)(line);
}

function prettyLine(level: Level, msg: string, meta?: Record<string, unknown>) {
  const tag = `[${level.toUpperCase()}]`.padEnd(7);
  const metaStr = meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  return `${tag} ${msg}${metaStr}`;
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
};
