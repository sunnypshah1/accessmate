export const log = {
info: (m: string, data?: unknown) => console.log(`[info] ${m}`, data ?? ''),
warn: (m: string, data?: unknown) => console.warn(`[warn] ${m}`, data ?? ''),
error: (m: string, data?: unknown) => console.error(`[error] ${m}`, data ?? ''),
};