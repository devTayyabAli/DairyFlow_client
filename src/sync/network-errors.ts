/**
 * Turns low-level fetch failures into messages a farmer can act on.
 * Pure module (no React Native imports) so it can be unit-tested with plain Node.
 */

export type ErrorLang = 'en' | 'ur';

export const REQUEST_TIMEOUT_MS = 20_000;

const NETWORK_PATTERN =
  /network request failed|fetch failed|failed to fetch|unable to resolve host|unknownhost|failed to connect|connection (refused|reset|closed|aborted)|software caused connection abort|econnrefused|econnreset|enotfound|etimedout|timed out|timeout|aborted|socket|ssl|certificate|load failed|offline/i;

/** True for "could not reach the server" failures (DNS, offline, refused, timeout, TLS). */
export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { name?: string; message?: string };
  if (e.name === 'AbortError' || e.name === 'TimeoutError') return true;
  const text = `${e.name ?? ''} ${e.message ?? String(err)}`;
  return err instanceof TypeError || NETWORK_PATTERN.test(text);
}

export function networkErrorMessage(lang: ErrorLang): string {
  return lang === 'ur'
    ? 'سرور تک رسائی نہیں ہو رہی۔ انٹرنیٹ چیک کرو تے دوبارہ کوشش کرو۔'
    : "Can't reach the server. Check your internet connection and try again.";
}

export function serverTroubleMessage(lang: ErrorLang): string {
  return lang === 'ur'
    ? 'سرور وچ مسئلہ اے۔ تھوڑی دیر بعد دوبارہ کوشش کرو۔'
    : 'The server is having trouble. Please try again in a few minutes.';
}

export function genericErrorMessage(lang: ErrorLang): string {
  return lang === 'ur' ? 'کوئی مسئلہ آ گیا۔ دوبارہ کوشش کرو۔' : 'Something went wrong. Please try again.';
}

/** User-facing text for any thrown error; technical details are never shown to the user. */
export function describeError(err: unknown, lang: ErrorLang): string {
  return isNetworkError(err) ? networkErrorMessage(lang) : genericErrorMessage(lang);
}

/** fetch with a hard timeout so a dead connection cannot leave the UI spinning forever. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
