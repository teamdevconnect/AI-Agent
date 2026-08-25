import { BadRequestException } from '@nestjs/common';
import { promises as dns, LookupAddress } from 'dns';
import { isIP } from 'net';

// Blocks outbound requests to internal/private network targets — the
// Dynamic Executor (dynamic-executor.service.ts) and testConnection
// (integrations.service.ts) both let an admin type an arbitrary URL that
// this server then fetches, which is a classic SSRF vector (e.g. pointing
// an endpoint at the cloud metadata service, 169.254.169.254, or an
// internal-only admin panel on 127.0.0.1/10.x/192.168.x).
//
// Re-resolves and re-checks on every call rather than only at save time —
// a hostname that pointed somewhere public when the admin configured it
// could be repointed at an internal IP later (DNS rebinding), so the check
// has to happen right before each actual request, not just once.
const PRIVATE_IPV4_RANGES: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local — covers the AWS/GCP/Azure metadata IP 169.254.169.254
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
];

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const target = ipv4ToInt(ip);
  return PRIVATE_IPV4_RANGES.some(([base, prefix]) => {
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (target & mask) === (ipv4ToInt(base) & mask);
  });
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true; // loopback
  if (normalized.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 — check the embedded IPv4 address.
    const mapped = normalized.slice('::ffff:'.length);
    return isIP(mapped) === 4 && isPrivateIpv4(mapped);
  }
  return /^f[cd][0-9a-f]{2}:/.test(normalized) || normalized.startsWith('fe80:'); // unique-local / link-local
}

function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true; // not a recognizable IP — fail closed
}

/** Throws BadRequestException if `url` targets a private/internal/loopback
 * network location, otherwise resolves silently. Call immediately before
 * every outbound integration request, not just once at save time. */
export async function assertPublicHttpUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('Invalid URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException('Only http/https URLs are allowed.');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  if (hostname.toLowerCase() === 'localhost') {
    throw new BadRequestException('Requests to localhost are not allowed.');
  }

  const literalVersion = isIP(hostname);
  let addresses: LookupAddress[];
  if (literalVersion) {
    addresses = [{ address: hostname, family: literalVersion }];
  } else {
    try {
      addresses = await dns.lookup(hostname, { all: true });
    } catch {
      throw new BadRequestException(`Could not resolve host "${hostname}".`);
    }
  }

  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new BadRequestException('This URL resolves to a private/internal network address and is not allowed.');
  }
}
