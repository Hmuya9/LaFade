/**
 * Production-safe logging utilities
 * 
 * In production, only logs errors and warnings.
 * In development, logs everything for debugging.
 */

const isProduction = process.env.NODE_ENV === "production";

/**
 * Log debug information (only in development)
 */
export function logDebug(...args: any[]) {
  if (!isProduction) {
    console.log(...args);
  }
}

/**
 * Log warning (always logged, but can be sent to service in production)
 */
export function logWarning(...args: any[]) {
  console.warn(...args);
  // TODO: Send to error tracking service in production
}

/**
 * Log error (always logged, should be sent to service in production)
 */
export function logError(...args: any[]) {
  console.error(...args);
  // TODO: Send to error tracking service in production
}

/**
 * Log info (only in development, use sparingly in production)
 */
export function logInfo(...args: any[]) {
  if (!isProduction) {
    console.log(...args);
  }
}



