export const log = {
  info: (message: string, data?: unknown) => console.log(`[info] ${message}`, data ?? ''),
  warn: (message: string, data?: unknown) => console.warn(`[warn] ${message}`, data ?? ''),
  error: (message: string, data?: unknown) => console.error(`[error] ${message}`, data ?? ''),
};