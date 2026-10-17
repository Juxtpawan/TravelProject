const COUNTRY_LOOKUP_URL = 'https://ipapi.co/json/';
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

/**
 * Detect the visitor's country from their public IP address.
 * Returns an ISO 3166-1 alpha-2 code, or null when lookup fails or times out.
 */
export async function detectCountryCode({ signal, timeoutMs = 2500 } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const abortLookup = () => controller.abort();

  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abortLookup, { once: true });

  try {
    const response = await fetch(COUNTRY_LOOKUP_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(`Country lookup failed: ${response.status}`);

    const data = await response.json();
    const countryCode = typeof data.country_code === 'string' ? data.country_code.toUpperCase() : '';
    return COUNTRY_CODE_PATTERN.test(countryCode) ? countryCode : null;
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.warn('[Country] Could not detect visitor country.', error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortLookup);
  }
}
