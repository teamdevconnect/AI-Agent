import geoip from 'geoip-lite';

// Small hand-rolled parser rather than a ua-parser-js-style dependency —
// the display need ("Chrome on Windows") is modest and this is swappable
// for a real library later with zero schema impact (the raw userAgent
// string is stored alongside the parsed label either way, see
// SessionEntry in user.schema.ts).
const BROWSER_PATTERNS: [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/Chrome\//, 'Chrome'],
  [/Firefox\//, 'Firefox'],
  [/Safari\//, 'Safari'],
];

const OS_PATTERNS: [RegExp, string][] = [
  [/Windows/, 'Windows'],
  [/Mac OS X/, 'macOS'],
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Linux/, 'Linux'],
];

export function parseDeviceLabel(userAgent?: string): string {
  if (!userAgent) return 'Unknown device';
  const browser = BROWSER_PATTERNS.find(([re]) => re.test(userAgent))?.[1] ?? 'Unknown browser';
  const os = OS_PATTERNS.find(([re]) => re.test(userAgent))?.[1] ?? 'Unknown OS';
  return `${browser} on ${os}`;
}

// Mobile-vs-desktop classification for Web Push delivery filtering (see
// WebPushService) — deliberately separate from parseDeviceLabel above,
// which is purely cosmetic; this one gates real delivery behavior.
export function classifyDeviceType(userAgent?: string): 'desktop' | 'mobile' {
  if (!userAgent) return 'desktop';
  return /Mobile|Android|iPhone|iPod/.test(userAgent) ? 'mobile' : 'desktop';
}

// geoip-lite ships an offline city-level database — no external API call,
// no key, no per-login network request. Loopback/private IPs (local dev)
// have no entry, which is expected, not an error.
export function lookupLocation(ip?: string): string | undefined {
  if (!ip) return undefined;
  const normalized = ip.replace(/^::ffff:/, '');
  const result = geoip.lookup(normalized);
  if (!result) return undefined;
  return result.city ? `${result.city}, ${result.country}` : result.country;
}
