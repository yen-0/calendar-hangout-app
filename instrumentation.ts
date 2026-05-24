/**
 * Next.js instrumentation entry point — called once per server runtime.
 * Routes to the matching Sentry config so server/edge runtimes both wire up.
 * If SENTRY_DSN is unset, each config is a no-op so this is safe to ship without setup.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
