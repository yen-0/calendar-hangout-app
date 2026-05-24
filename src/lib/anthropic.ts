import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

let cached: Anthropic | null | undefined;

/**
 * Returns a cached Anthropic SDK instance, or null if ANTHROPIC_API_KEY is unset.
 * Callers handle the null case so the AI ranking feature degrades gracefully
 * when no key is provisioned (e.g., demo deployments).
 */
export function getAnthropic(): Anthropic | null {
  if (cached !== undefined) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  cached = apiKey ? new Anthropic({ apiKey }) : null;
  return cached;
}
